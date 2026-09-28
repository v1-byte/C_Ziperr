// tools/collect.mjs (v2) - dipanggil oleh .github/workflows/collect.yml
// ENV: GAME_URL (wajib) OUT PLAY_SECONDS SPINS SPIN_X SPIN_Y CRAWL(0/1) CRAWL_MAX HAR(0/1)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const E = process.env;
const GAME_URL = E.GAME_URL;
if (!GAME_URL) throw new Error('GAME_URL wajib diisi');
const OUT = E.OUT || 'out';
const PLAY_SECONDS = +(E.PLAY_SECONDS || 90), SPINS = +(E.SPINS || 30);
const CRAWL_MAX = +(E.CRAWL_MAX || 400);
const origHost = new URL(GAME_URL).hostname;

const STATIC = /\.(m?js|css|html?|png|jpe?g|webp|gif|svg|ico|mp3|ogg|wav|m4a|aac|mp4|webm|json|atlas|skel|xml|txt|fnt|ttf|otf|woff2?|wasm|bin|ktx2?|basis|glb|gltf|map)$/i;
const EXTS = 'png|jpe?g|webp|gif|svg|mp3|ogg|wav|m4a|mp4|webm|json|atlas|skel|woff2?|ttf|otf|wasm|bin|ktx2?|js|css|glb|gltf';
const RE = new RegExp(`["'(]((?:https?:)?[\\w@:.\\/-]+\\.(?:${EXTS}))(?:\\?[^"'\\s)]*)?["')]`, 'gi');

const seen = new Map();   // url -> {file,size,layer,cdn}
const texts = [];         // {url,text} untuk crawl
const api = [];
const failed = [];
const tried = new Set();

const extOf = (u) => new URL(u).pathname.split('.').pop().toLowerCase();
function layerOf(u, ct = '') {
  const e = extOf(u);
  if (/^html?$/.test(e) || ct.includes('text/html')) return 'html';
  if (/^(m?js|css|map)$/.test(e)) return 'js';
  if (/^(json|atlas|xml|txt|csv|skel)$/.test(e)) return 'data';
  return 'asset';
}
function filePath(dir, u) {
  const x = new URL(u);
  let p = decodeURIComponent(x.pathname);
  p = path.posix.normalize('/' + p); if (p.endsWith('/')) p += 'index.html';
  return path.join(OUT, dir, x.hostname, p).replace(/[<>:"|?*]/g, '_');
}
function saveAsset(u, buf, ct) {
  if (seen.has(u.split('?')[0])) return;
  const layer = layerOf(u, ct);
  const file = filePath('assets', u);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  seen.set(u.split('?')[0], { file, size: buf.length, layer, cdn: new URL(u).hostname !== origHost });
  if (['html', 'js', 'data'].includes(layer) && buf.length < 5e6) texts.push({ url: u, text: buf.toString('utf8') });
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 414, height: 896 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
  serviceWorkers: 'block',
  ...(E.HAR === '1' ? { recordHar: { path: path.join(OUT, 'traffic.har'), content: 'embed' } } : {}),
});
if (E.COOKIES) {
  const raw = E.COOKIES.trim();
  let list;
  try { list = JSON.parse(raw); } catch { list = raw.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const i = s.indexOf('='); return { name: s.slice(0, i), value: s.slice(i + 1), domain: origHost, path: '/' }; }); }
  await ctx.addCookies(list).catch((e) => failed.push({ url: 'cookies', error: String(e.message || e) }));
}
const page = await ctx.newPage();

page.on('response', async (res) => {
  const req = res.request(), url = res.url();
  if (!/^https?:/.test(url) || (res.status() >= 300 && res.status() < 400)) return;
  try {
    if (res.status() >= 400) { failed.push({ url, error: 'HTTP ' + res.status() }); return; }
    const ct = res.headers()['content-type'] || '';
    let body = await res.body();
    const isApi = req.method() !== 'GET' ||
      (['fetch', 'xhr'].includes(req.resourceType()) && !STATIC.test(new URL(url).pathname));
    if (isApi) {
      api.push({ n: api.length + 1, url, method: req.method(), status: res.status(),
        request: req.postData() || null, response: body.toString('utf8'), ...(body.toString('utf8').includes('\uFFFD') ? { response_b64: body.toString('base64') } : {}) });
      return;
    }
    if (res.status() === 206) body = await (await ctx.request.get(url)).body(); // ambil utuh
    saveAsset(url, body, ct);
  } catch (e) { failed.push({ url, error: String(e.message || e) }); }
});

await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
await page.waitForTimeout(8000);
for (const frame of page.frames())
  for (const label of ['Play', 'Start', 'Continue', 'OK', 'Enter']) {
    const b = frame.getByText(new RegExp(`^${label}$`, 'i')).first();
    if (await b.count().catch(() => 0)) await b.click({ timeout: 2000 }).catch(() => {});
  }
const vp = page.viewportSize();
await page.mouse.click(vp.width / 2, vp.height / 2).catch(() => {});
const sx = +(E.SPIN_X || vp.width / 2), sy = +(E.SPIN_Y || vp.height * 0.88);
const gap = Math.max(2500, (PLAY_SECONDS * 1000) / Math.max(SPINS, 1));
for (let i = 0; i < SPINS; i++) { await page.mouse.click(sx, sy).catch(() => {}); await page.waitForTimeout(gap); }
await page.waitForTimeout(3000);

// Lapisan 1: HTML hasil render
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.rendered.html'), await page.content());

// Lapisan 2-5: crawl referensi yang belum termuat (bonus, bahasa lain, chunk)
let crawled = 0;
if (E.CRAWL !== '0') {
  for (let pass = 0; pass < 3 && crawled < CRAWL_MAX; pass++) {
    const found = new Set();
    for (const t of texts)
      for (const m of t.text.matchAll(RE)) {
        try {
          const abs = new URL(m[1], t.url).href.split('#')[0];
          if (!seen.has(abs.split('?')[0]) && !tried.has(abs)) found.add(abs);
        } catch {}
      }
    if (!found.size) break;
    for (const abs of found) {
      if (crawled++ >= CRAWL_MAX) break;
      tried.add(abs);
      const r = await ctx.request.get(abs).catch(() => null);
      if (r && r.ok()) saveAsset(abs, await r.body(), r.headers()['content-type'] || '');
      else failed.push({ url: abs, error: (r ? 'HTTP ' + r.status() : 'gagal') + ' (crawl)' });
    }
  }
}
await browser.close();

// Lapisan 6: API direkam sebagai server/NNNN.json
api.forEach((a) => {
  const f = path.join(OUT, 'server', String(a.n).padStart(4, '0') + '.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(a, null, 2));
});
const kinds = { login: 0, state: 0, balance: 0, spin: 0, lain: 0 };
api.forEach((a) => {
  const u = a.url.toLowerCase();
  kinds[/login|auth|token|session/.test(u) ? 'login' : /balance|wallet/.test(u) ? 'balance'
    : /spin|bet|play|action/.test(u) ? 'spin' : /init|config|state|load/.test(u) ? 'state' : 'lain']++;
});

const layers = { html: 0, js: 0, data: 0, asset: 0, cdn: 0, api: api.length };
seen.forEach((s) => { layers[s.layer]++; if (s.cdn) layers.cdn++; });
const report = { source: GAME_URL, at: new Date().toISOString(), total: seen.size, layers, apiKinds: kinds, failed };
fs.writeFileSync(path.join(OUT, 'kelengkapan.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT, 'keterangan.json'), JSON.stringify({ ...report, failed: failed.length }, null, 2));
fs.writeFileSync(path.join(OUT, 'KETERANGAN.md'),
`# Hasil collect

- Sumber: ${GAME_URL}
- Total file: ${seen.size} (di assets/)
- HTML: ${layers.html} | JS/CSS: ${layers.js} | Data: ${layers.data} | Asset: ${layers.asset} | CDN (domain lain): ${layers.cdn}
- API terekam: ${api.length} (di server/) -> login ${kinds.login}, state ${kinds.state}, balance ${kinds.balance}, spin ${kinds.spin}, lain ${kinds.lain}
- Gagal: ${failed.length} (hasil crawl bisa berisi tebakan path yang memang tidak ada)
`);
console.log(`Selesai. file=${seen.size} api=${api.length} gagal=${failed.length}`);
