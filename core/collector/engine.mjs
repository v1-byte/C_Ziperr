import fs from 'node:fs';
import path from 'node:path';

const STATIC = /\.(m?js|css|html?|png|jpe?g|webp|gif|svg|ico|mp3|ogg|wav|m4a|aac|mp4|webm|json|atlas|skel|xml|txt|fnt|ttf|otf|woff2?|wasm|bin|ktx2?|basis|glb|gltf|map)$/i;
const EXTS = 'png|jpe?g|webp|gif|svg|mp3|ogg|wav|m4a|mp4|webm|json|atlas|skel|woff2?|ttf|otf|wasm|bin|ktx2?|js|css|glb|gltf';
const URL_RE = new RegExp(`["'(]((?:https?:)?[\\w@:.\\/-]+\\.(?:${EXTS}))(?:\\?[^"'\\s)]*)?["')]`, 'gi');
const MAX_TEXT = 5e6;

export function makeConfig(env = process.env) {
  const url = String(env.GAME_URL || env.game_url || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('GAME_URL wajib berupa URL http/https');
  return {
    gameUrl: url, out: String(env.OUT || 'out'), playSeconds: clamp(env.PLAY_SECONDS, 90, 1, 600), spins: clamp(env.SPINS, 30, 0, 500),
    spinX: numberOrNull(env.SPIN_X), spinY: numberOrNull(env.SPIN_Y), crawl: env.CRAWL !== '0', crawlMax: clamp(env.CRAWL_MAX, 400, 1, 2000),
    har: env.HAR === '1', cookies: String(env.COOKIES || ''), userAgent: String(env.USER_AGENT || 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')
  };
}
function clamp(v, d, min, max) { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; }
function numberOrNull(v) { const n = Number(v); return Number.isFinite(n) && String(v ?? '').trim() ? n : null; }
function extOf(u) { return new URL(u).pathname.split('.').pop().toLowerCase(); }
function layerOf(u, ct = '') { const e = extOf(u); if (/^html?$/.test(e) || ct.includes('text/html')) return 'html'; if (/^(m?js|css|map)$/.test(e)) return 'js'; if (/^(json|atlas|xml|txt|csv|skel)$/.test(e)) return 'data'; return 'asset'; }
function safeName(v) { return v.replace(/[<>:"|?*]/g, '_'); }
function filePath(out, u) { const x = new URL(u); let p = decodeURIComponent(x.pathname); p = path.posix.normalize('/' + p); if (p.endsWith('/')) p += 'index.html'; return path.join(out, 'assets', x.hostname, safeName(p)); }
function parseCookies(raw, domain) { if (!raw) return []; try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return raw.split(';').map(s => s.trim()).filter(Boolean).map(s => { const i = s.indexOf('='); return { name: s.slice(0, i), value: s.slice(i + 1), domain, path: '/' }; }); } }

export async function collectGame(config, { chromium, onProgress = () => {}, fsImpl = fs } = {}) {
  if (!chromium) throw new Error('Playwright chromium wajib diberikan');
  const cfg = config.gameUrl ? config : makeConfig(config);
  const out = cfg.out, originHost = new URL(cfg.gameUrl).hostname;
  const seen = new Map(), texts = [], api = [], failed = [], tried = new Set(), cdnDomains = new Map();
  const saveAsset = (u, buf, ct, source = 'response') => {
    const clean = u.split('#')[0].split('?')[0]; if (seen.has(clean)) return false;
    const layer = layerOf(u, ct); const file = filePath(out, u); fsImpl.mkdirSync(path.dirname(file), { recursive: true }); fsImpl.writeFileSync(file, buf);
    const host = new URL(u).hostname, cdn = host !== originHost;
    seen.set(clean, { file, url: u, size: buf.length, layer, cdn, source });
    if (cdn) { const item = cdnDomains.get(host) || { host, requests: 0, files: 0, failed: 0, urls: [] }; item.files++; item.urls.push(u); cdnDomains.set(host, item); }
    if (['html', 'js', 'data'].includes(layer) && buf.length < MAX_TEXT) texts.push({ url: u, text: buf.toString('utf8') });
    return true;
  };
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, userAgent: cfg.userAgent, serviceWorkers: 'block', ...(cfg.har ? { recordHar: { path: path.join(out, 'traffic.har'), content: 'embed' } } : {}) });
  if (cfg.cookies) await ctx.addCookies(parseCookies(cfg.cookies, originHost)).catch(e => failed.push({ url: 'cookies', error: String(e.message || e) }));
  const page = await ctx.newPage();
  page.on('request', req => { try { const host = new URL(req.url()).hostname; if (host !== originHost) { const item = cdnDomains.get(host) || { host, requests: 0, files: 0, failed: 0, urls: [] }; item.requests++; cdnDomains.set(host, item); } } catch {} });
  page.on('response', async res => {
    const req = res.request(), url = res.url(); if (!/^https?:/.test(url) || (res.status() >= 300 && res.status() < 400)) return;
    try {
      if (res.status() >= 400) { failed.push({ url, error: 'HTTP ' + res.status(), layer: new URL(url).hostname !== originHost ? 'cdn' : 'origin' }); return; }
      const ct = res.headers()['content-type'] || ''; let body = await res.body();
      const isApi = req.method() !== 'GET' || (['fetch', 'xhr'].includes(req.resourceType()) && !STATIC.test(new URL(url).pathname));
      if (isApi) { const text = body.toString('utf8'); api.push({ n: api.length + 1, url, method: req.method(), status: res.status(), request: req.postData() || null, response: text.includes('\uFFFD') ? undefined : text, ...(text.includes('\uFFFD') ? { response_b64: body.toString('base64') } : {}) }); return; }
      if (res.status() === 206) body = await (await ctx.request.get(url)).body();
      saveAsset(url, body, ct, 'response'); onProgress({ phase: 'capture', files: seen.size, api: api.length });
    } catch (e) { failed.push({ url, error: String(e.message || e) }); }
  });
  await page.goto(cfg.gameUrl, { waitUntil: 'networkidle', timeout: 120000 }).catch(e => failed.push({ url: cfg.gameUrl, error: String(e.message || e) }));
  await page.waitForTimeout(8000);
  for (const frame of page.frames()) for (const label of ['Play', 'Start', 'Continue', 'OK', 'Enter']) { const b = frame.getByText(new RegExp(`^${label}$`, 'i')).first(); if (await b.count().catch(() => 0)) await b.click({ timeout: 2000 }).catch(() => {}); }
  const vp = page.viewportSize(); const sx = cfg.spinX ?? vp.width / 2, sy = cfg.spinY ?? vp.height * 0.88; const gap = Math.max(2500, (cfg.playSeconds * 1000) / Math.max(cfg.spins, 1));
  for (let i = 0; i < cfg.spins; i++) { await page.mouse.click(sx, sy).catch(() => {}); await page.waitForTimeout(gap); onProgress({ phase: 'interaction', spin: i + 1, spins: cfg.spins, files: seen.size, api: api.length }); }
  await page.waitForTimeout(3000); fsImpl.mkdirSync(out, { recursive: true }); fsImpl.writeFileSync(path.join(out, 'index.rendered.html'), await page.content());
  let crawled = 0;
  if (cfg.crawl) for (let pass = 0; pass < 3 && crawled < cfg.crawlMax; pass++) {
    const found = new Set(); for (const t of texts) for (const m of t.text.matchAll(URL_RE)) { try { const abs = new URL(m[1], t.url).href.split('#')[0]; if (!seen.has(abs.split('?')[0]) && !tried.has(abs)) found.add(abs); } catch {} }
    if (!found.size) break;
    for (const abs of found) { if (crawled++ >= cfg.crawlMax) break; tried.add(abs); const r = await ctx.request.get(abs).catch(() => null); if (r && r.ok()) saveAsset(abs, await r.body(), r.headers()['content-type'] || '', 'crawl'); else { failed.push({ url: abs, error: (r ? 'HTTP ' + r.status() : 'gagal') + ' (crawl)', layer: new URL(abs).hostname !== originHost ? 'cdn' : 'origin' }); const host = new URL(abs).hostname; if (host !== originHost) { const item = cdnDomains.get(host) || { host, requests: 0, files: 0, failed: 0, urls: [] }; item.failed++; cdnDomains.set(host, item); } } }
    onProgress({ phase: 'cdn-crawl', crawled, max: cfg.crawlMax, files: seen.size });
  }
  await browser.close();
  api.forEach(a => { const f = path.join(out, 'server', String(a.n).padStart(4, '0') + '.json'); fsImpl.mkdirSync(path.dirname(f), { recursive: true }); fsImpl.writeFileSync(f, JSON.stringify(a, null, 2)); });
  const kinds = { login: 0, state: 0, balance: 0, spin: 0, lain: 0 }; api.forEach(a => { const u = a.url.toLowerCase(); kinds[/login|auth|token|session/.test(u) ? 'login' : /balance|wallet/.test(u) ? 'balance' : /spin|bet|play|action/.test(u) ? 'spin' : /init|config|state|load/.test(u) ? 'state' : 'lain']++; });
  const layers = { html: 0, js: 0, data: 0, asset: 0, cdn: 0, api: api.length }; seen.forEach(s => { layers[s.layer]++; if (s.cdn) layers.cdn++; });
  const cdn = { domains: [...cdnDomains.values()].map(x => ({ ...x, urls: [...new Set(x.urls)].slice(0, 100) })), totalDomains: cdnDomains.size, capturedFiles: layers.cdn, failed: failed.filter(x => x.layer === 'cdn').length, crawled };
  const report = { source: cfg.gameUrl, at: new Date().toISOString(), total: seen.size, layers, apiKinds: kinds, failed, cdn };
  fsImpl.writeFileSync(path.join(out, 'kelengkapan.json'), JSON.stringify(report, null, 2)); fsImpl.writeFileSync(path.join(out, 'keterangan.json'), JSON.stringify({ ...report, failed: failed.length }, null, 2));
  fsImpl.writeFileSync(path.join(out, 'cdn-manifest.json'), JSON.stringify({ source: cfg.gameUrl, generatedAt: report.at, ...cdn, resources: [...seen.values()].filter(x => x.cdn).map(x => ({ url: x.url, file: x.file, layer: x.layer, size: x.size })) }, null, 2));
  fsImpl.writeFileSync(path.join(out, 'cdn-missing.json'), JSON.stringify(failed.filter(x => x.layer === 'cdn'), null, 2));
  fsImpl.writeFileSync(path.join(out, 'cdn-domains.json'), JSON.stringify(cdn.domains, null, 2));
  fsImpl.writeFileSync(path.join(out, 'KETERANGAN.md'), `# Hasil collect\n\n- Sumber: ${cfg.gameUrl}\n- Total file: ${seen.size}\n- HTML: ${layers.html} | JS/CSS: ${layers.js} | Data: ${layers.data} | Asset: ${layers.asset}\n- CDN: ${layers.cdn} file pada ${cdn.totalDomains} domain; gagal: ${cdn.failed}\n- API terekam: ${api.length}\n- Gagal total: ${failed.length}\n\nCDN yang tidak berhasil diambil tercatat di \`cdn-missing.json\`.\n`);
  return { ...report, output: out };
}
