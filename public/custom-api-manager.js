import {
  DEFAULT_ENDPOINTS,
  DEFAULT_REQUEST_FIELDS,
  DEFAULT_RESPONSE_FIELDS,
  detectApiEndpoints,
  normalizeApiBase,
  normalizeEndpointConfig,
  buildApiContract,
  buildHostingArtifacts,
  validateHostingPackage
} from './custom-api-contract.js';

const TEXT_EXT = /\.(?:html?|m?js|cjs|css|json|ya?ml|md|txt|xml|svg|env|toml|ini)$/i;
const modalId = 'gc-custom-api-manager';
let lastDetection = [];
let busy = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function el(id) { return document.getElementById(id); }
function setStatus(text, kind = 'info') {
  const target = el('gc-api-status');
  if (target) { target.textContent = text; target.dataset.kind = kind; }
}
function setBusy(value) {
  busy = Boolean(value);
  document.querySelectorAll('#gc-custom-api-manager button[data-busy]').forEach((button) => { button.disabled = busy; });
}
function bridge() { return window.__GC_CUSTOM_API_BRIDGE || null; }

function ensureModal() {
  let modal = el(modalId);
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'gc-api-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'gc-api-title');
  modal.innerHTML = `
    <section class="gc-api-card">
      <header class="gc-api-header">
        <div><div class="gc-api-kicker">WORKSPACE · API TOOLKIT</div><h2 id="gc-api-title">Custom API &amp; Hosting</h2><p>Konfigurasi untuk backend demo atau server yang Anda miliki dan berwenang kelola. Tidak memulihkan server/credential lama dan tidak melakukan deploy.</p></div>
        <button type="button" class="gc-api-close" aria-label="Tutup" data-action="close">×</button>
      </header>
      <div class="gc-api-body">
        <div class="gc-api-grid">
          <label class="gc-api-field gc-api-wide"><span>Base URL server</span><input id="gc-api-base" type="url" placeholder="https://api-server-anda.example" autocomplete="url"><small>Gunakan HTTPS. URL localhost hanya untuk pengujian lokal.</small></label>
          <label class="gc-api-field"><span>Game ID</span><input id="gc-api-game-id" type="text" value="game-demo" maxlength="100"></label>
          <label class="gc-api-field"><span>Format response</span><select id="gc-api-format"><option value="json">JSON</option><option value="json-envelope">JSON envelope (data/result)</option><option value="custom">Custom JSON</option></select></label>
          <div class="gc-api-field gc-api-wide"><span>Endpoint wajib</span><div id="gc-api-endpoints" class="gc-api-endpoints"></div></div>
          <label class="gc-api-field"><span>Request fields</span><textarea id="gc-api-request-fields" rows="3"></textarea><small>Satu nama field per baris; tidak menyimpan nilai password/token.</small></label>
          <label class="gc-api-field"><span>Response fields</span><textarea id="gc-api-response-fields" rows="3"></textarea></label>
          <label class="gc-api-field"><span>Headers (JSON)</span><textarea id="gc-api-headers" rows="5" spellcheck="false"></textarea><small>Gunakan placeholder environment, bukan credential aktual.</small></label>
          <label class="gc-api-field"><span>Parameter (JSON)</span><textarea id="gc-api-parameters" rows="5" spellcheck="false"></textarea></label>
        </div>
        <section class="gc-api-detect"><div><strong>Deteksi dari ZIP</strong><span id="gc-api-detect-summary">Belum dipindai.</span></div><button type="button" class="gc-api-btn secondary" data-action="detect" data-busy>Deteksi API</button></section>
        <div id="gc-api-detected" class="gc-api-detected" hidden></div>
        <section class="gc-api-test">
          <div><strong>Test API</strong><span>GET dapat mengirim request baca. POST/PUT/DELETE default hanya menguji OPTIONS agar tidak mengubah saldo/data.</span></div>
          <div class="gc-api-test-controls"><select id="gc-api-test-endpoint" aria-label="Endpoint untuk test"></select><button type="button" class="gc-api-btn secondary" data-action="test" data-busy>Test endpoint</button><label class="gc-api-check"><input id="gc-api-allow-write" type="checkbox"> Izinkan request tulis pada demo/staging milik saya</label></div>
          <pre id="gc-api-test-result" class="gc-api-output" aria-live="polite">Belum ada test.</pre>
        </section>
        <section class="gc-api-actions">
          <button type="button" class="gc-api-btn secondary" data-action="contract" data-busy>Generate API Contract</button>
          <button type="button" class="gc-api-btn secondary" data-action="copy" data-busy>Salin konfigurasi API</button>
          <button type="button" class="gc-api-btn secondary" data-action="save" data-busy>Save Workspace</button>
          <button type="button" class="gc-api-btn primary" data-action="package" data-busy>Generate Hosting Package</button>
          <button type="button" class="gc-api-btn secondary" data-action="validate" data-busy>Validate Hosting</button>
          <button type="button" class="gc-api-btn ready" data-action="ready" data-busy>Ready Hosting</button>
        </section>
        <div id="gc-api-status" class="gc-api-status" data-kind="info" aria-live="polite">Konfigurasi disimpan hanya ketika Anda memilih Save Workspace atau Generate Hosting Package.</div>
        <div id="gc-api-validation" class="gc-api-validation" hidden></div>
        <details class="gc-api-security"><summary>Catatan keamanan dan kompatibilitas</summary><ul><li>API map hasil capture dipertahankan; mapping hosting ditambahkan sebagai metadata.</li><li>Token, password, JWT secret, database URL, dan signing key tidak dimasukkan ke kontrak. Isi di server melalui secret manager.</li><li>POST spin/bet dapat mengubah state; pengujian tulis hanya untuk backend demo/staging yang Anda kontrol.</li><li>Generate Hosting Package menyiapkan file dokumentasi/config di ZIP; bukan membuat server live atau mengubah APK rilis.</li></ul><button type="button" class="gc-api-btn secondary" data-action="rewrite" data-busy>Rewrite URL lama (manual)</button></details>
      </div>
    </section>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', async (event) => {
    if (event.target === modal || event.target.closest('[data-action="close"]')) { closeModal(); return; }
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled || busy) return;
    event.preventDefault();
    await handleAction(button.dataset.action);
  });
  modal.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
  return modal;
}

function installStyles() {
  if (el('gc-custom-api-style')) return;
  const style = document.createElement('style');
  style.id = 'gc-custom-api-style';
  style.textContent = `
    .gc-api-modal{position:fixed;inset:0;z-index:100500;display:none;align-items:center;justify-content:center;padding:14px;background:rgba(2,6,12,.78);backdrop-filter:blur(5px);font-family:Inter,system-ui,sans-serif;color:#e6edf3}
    .gc-api-modal.open{display:flex}.gc-api-card{width:min(980px,100%);max-height:min(94vh,900px);display:flex;flex-direction:column;background:#101821;border:1px solid #34475a;border-radius:16px;box-shadow:0 26px 90px #000a;overflow:hidden}
    .gc-api-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:18px 22px;background:linear-gradient(115deg,#142b31,#121c2a);border-bottom:1px solid #304354}.gc-api-header h2{margin:3px 0 5px;font-size:21px;color:#effaf7}.gc-api-header p{margin:0;max-width:760px;color:#a9bbc7;font-size:12px;line-height:1.5}.gc-api-kicker{font:700 10px/1.3 ui-monospace,monospace;letter-spacing:.12em;color:#5ee1c0}.gc-api-close{border:1px solid #476074;background:#172532;color:#d9e8ed;border-radius:8px;width:34px;height:34px;font-size:23px;line-height:1;cursor:pointer}
    .gc-api-body{padding:16px 20px 20px;overflow:auto}.gc-api-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.gc-api-field{display:flex;flex-direction:column;gap:6px;min-width:0;color:#d5e2e9;font-size:12px;font-weight:650}.gc-api-field>span{font-size:12px}.gc-api-field small{color:#90a3af;font-size:10px;font-weight:400;line-height:1.4}.gc-api-field code{color:#8ff2d5}.gc-api-wide{grid-column:1/-1}.gc-api-field input,.gc-api-field select,.gc-api-field textarea,.gc-api-test select{box-sizing:border-box;width:100%;border:1px solid #344b5c;border-radius:8px;background:#0b1219;color:#e5eff4;padding:9px 10px;font:12px/1.45 ui-monospace,monospace;outline:none}.gc-api-field input:focus,.gc-api-field select:focus,.gc-api-field textarea:focus,.gc-api-test select:focus{border-color:#5ee1c0;box-shadow:0 0 0 2px #5ee1c020}.gc-api-endpoints{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.gc-api-endpoint{display:grid;grid-template-columns:minmax(90px,.75fr) 84px minmax(140px,1.4fr);align-items:center;gap:6px;padding:7px;border:1px solid #293c4c;border-radius:8px;background:#0c141b}.gc-api-endpoint b{font-size:11px;color:#c7d6df}.gc-api-endpoint select,.gc-api-endpoint input{min-width:0;padding:7px 6px;border:1px solid #344b5c;border-radius:6px;background:#0a1117;color:#dbe8ee;font:11px ui-monospace,monospace}.gc-api-detect,.gc-api-test{margin-top:13px;padding:11px;border:1px solid #2c4151;border-radius:10px;background:#0c141c}.gc-api-detect,.gc-api-test>div:first-child{display:flex;justify-content:space-between;gap:12px;align-items:center}.gc-api-detect strong,.gc-api-test strong{display:block;font-size:12px}.gc-api-detect span,.gc-api-test span{display:block;margin-top:3px;font-size:10px;color:#94a7b4}.gc-api-detected{max-height:150px;overflow:auto;margin-top:8px;padding:9px;border-radius:8px;background:#080e13;color:#a9c3ca;font:10px/1.5 ui-monospace,monospace;white-space:pre-wrap}.gc-api-test-controls{display:grid;grid-template-columns:minmax(130px,1fr) auto;gap:7px;align-items:center;margin-top:9px}.gc-api-check{grid-column:1/-1;display:flex;align-items:center;gap:7px;color:#e4bf8a;font-size:10px}.gc-api-check input{accent-color:#5ee1c0}.gc-api-output{max-height:150px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;margin:9px 0 0;padding:9px;border:1px solid #233747;border-radius:8px;background:#070d12;color:#bed4dc;font:10px/1.5 ui-monospace,monospace}.gc-api-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}.gc-api-btn{border:1px solid #3c586a;border-radius:8px;padding:8px 10px;background:#13222c;color:#dcebf0;font-size:11px;font-weight:700;cursor:pointer}.gc-api-btn:hover{filter:brightness(1.2)}.gc-api-btn:disabled{opacity:.5;cursor:wait}.gc-api-btn.primary{border-color:#3aa88d;background:#17443d;color:#d7fff5}.gc-api-btn.ready{border-color:#7d6840;background:#342a17;color:#f7d99a}.gc-api-status{margin-top:11px;padding:9px 11px;border-radius:8px;background:#0d2024;border:1px solid #21444a;color:#a8d8cb;font-size:11px;line-height:1.45}.gc-api-status[data-kind="error"]{background:#2b1718;border-color:#703638;color:#ffc0b7}.gc-api-status[data-kind="warn"]{background:#292216;border-color:#655230;color:#f4d99b}.gc-api-status[data-kind="ok"]{background:#10261d;border-color:#2b694d;color:#a7ecc2}.gc-api-validation{margin-top:8px;padding:10px;border:1px solid #344b5c;border-radius:8px;background:#080e13;font:10px/1.55 ui-monospace,monospace}.gc-api-validation .bad{color:#ffaaa0}.gc-api-validation .warn{color:#f1d18a}.gc-api-validation .good{color:#8ae0ae}.gc-api-security{margin-top:11px;color:#9aadb9;font-size:10px}.gc-api-security summary{cursor:pointer;color:#b9cad4}.gc-api-security ul{padding-left:18px;line-height:1.5}.gc-api-security li{margin:3px 0}
    @media(max-width:680px){.gc-api-modal{padding:6px}.gc-api-card{max-height:98vh;border-radius:12px}.gc-api-header{padding:14px}.gc-api-body{padding:12px}.gc-api-grid{grid-template-columns:1fr}.gc-api-wide{grid-column:auto}.gc-api-endpoints{grid-template-columns:1fr}.gc-api-endpoint{grid-template-columns:minmax(80px,.7fr) 78px minmax(120px,1.3fr)}.gc-api-test-controls{grid-template-columns:1fr}.gc-api-check{grid-column:auto}.gc-api-actions .gc-api-btn{flex:1 1 140px}}
  `;
  document.head.appendChild(style);
}

function endpointMarkup(endpoint) {
  return `<label class="gc-api-endpoint" data-endpoint="${esc(endpoint.id)}"><b>${esc(endpoint.label)}</b><select aria-label="HTTP method ${esc(endpoint.label)}"><option${endpoint.method === 'GET' ? ' selected' : ''}>GET</option><option${endpoint.method === 'POST' ? ' selected' : ''}>POST</option><option${endpoint.method === 'PUT' ? ' selected' : ''}>PUT</option><option${endpoint.method === 'PATCH' ? ' selected' : ''}>PATCH</option><option${endpoint.method === 'DELETE' ? ' selected' : ''}>DELETE</option></select><input aria-label="Path ${esc(endpoint.label)}" value="${esc(endpoint.path)}" spellcheck="false"></label>`;
}

function readForm() {
  const endpoints = [...document.querySelectorAll('#gc-api-endpoints [data-endpoint]')].map((row) => ({
    id: row.dataset.endpoint,
    label: row.querySelector('b')?.textContent || row.dataset.endpoint,
    method: row.querySelector('select')?.value || 'GET',
    path: row.querySelector('input')?.value.trim() || ''
  }));
  let headers;
  let parameters;
  try { headers = JSON.parse(el('gc-api-headers').value || '{}'); } catch { throw new Error('Headers harus berupa JSON yang valid.'); }
  try { parameters = JSON.parse(el('gc-api-parameters').value || '{}'); } catch { throw new Error('Parameter harus berupa JSON yang valid.'); }
  if (!headers || Array.isArray(headers) || typeof headers !== 'object') throw new Error('Headers harus berupa object JSON.');
  if (!parameters || Array.isArray(parameters) || typeof parameters !== 'object') throw new Error('Parameter harus berupa object JSON.');
  return normalizeEndpointConfig({
    baseUrl: el('gc-api-base').value,
    gameId: el('gc-api-game-id').value,
    endpoints,
    headers,
    parameters,
    responseFormat: el('gc-api-format').value,
    requestFields: el('gc-api-request-fields').value.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
    responseFields: el('gc-api-response-fields').value.split(/[\n,]/).map((value) => value.trim()).filter(Boolean)
  });
}

async function readWorkspace() {
  const apiBridge = bridge();
  if (!apiBridge?.getZip()) throw new Error('Load ZIP ke Workspace terlebih dahulu.');
  return apiBridge.readFiles();
}

async function existingApiMap(files) {
  const path = Object.keys(files).find((name) => /(^|\/)api-map\.json$/i.test(name));
  if (!path) return null;
  try { return JSON.parse(files[path]); } catch { return null; }
}

async function loadExistingConfig() {
  const files = await readWorkspace();
  const configPath = Object.keys(files).find((name) => /(^|\/)hosting-config\.json$/i.test(name));
  if (configPath) {
    try {
      const saved = JSON.parse(files[configPath]);
      return normalizeEndpointConfig({
        baseUrl: saved.base_url,
        gameId: saved.game_id,
        endpoints: saved.endpoints,
        headers: saved.headers,
        parameters: saved.parameters,
        requestFields: saved.request_fields,
        responseFields: saved.response_fields,
        responseFormat: saved.response_format
      });
    } catch { /* use defaults */ }
  }
  return normalizeEndpointConfig({ baseUrl: window.__GC_LAST_API_BASE || '' });
}

function fillForm(config) {
  el('gc-api-base').value = config.baseUrl || '';
  el('gc-api-game-id').value = config.gameId || 'game-demo';
  el('gc-api-format').value = config.responseFormat || 'json';
  el('gc-api-request-fields').value = (config.requestFields || DEFAULT_REQUEST_FIELDS).join('\n');
  el('gc-api-response-fields').value = (config.responseFields || DEFAULT_RESPONSE_FIELDS).join('\n');
  el('gc-api-headers').value = JSON.stringify(config.headers || { 'Content-Type': 'application/json' }, null, 2);
  el('gc-api-parameters').value = JSON.stringify(config.parameters || { game_id: '${GAME_ID}', bet_amount: 100 }, null, 2);
  el('gc-api-endpoints').innerHTML = config.endpoints.map(endpointMarkup).join('');
  el('gc-api-test-endpoint').innerHTML = config.endpoints.map((endpoint) => `<option value="${esc(endpoint.id)}">${esc(endpoint.label)} · ${esc(endpoint.method)} ${esc(endpoint.path)}</option>`).join('');
}

function refreshTestEndpointList() {
  const current = el('gc-api-test-endpoint')?.value;
  const config = readForm();
  const select = el('gc-api-test-endpoint');
  if (!select) return;
  select.innerHTML = config.endpoints.map((endpoint) => `<option value="${esc(endpoint.id)}">${esc(endpoint.label)} · ${esc(endpoint.method)} ${esc(endpoint.path)}</option>`).join('');
  if (current && config.endpoints.some((endpoint) => endpoint.id === current)) select.value = current;
}

async function detect() {
  setBusy(true); setStatus('Memindai ZIP dan api-map.json…');
  try {
    const files = await readWorkspace();
    const apiMap = await existingApiMap(files);
    lastDetection = detectApiEndpoints(files, apiMap);
    const foundById = new Map();
    for (const item of lastDetection) {
      if (item.id !== 'other' && !foundById.has(item.id)) foundById.set(item.id, item);
    }
    for (const row of document.querySelectorAll('#gc-api-endpoints [data-endpoint]')) {
      const found = foundById.get(row.dataset.endpoint);
      if (!found) continue;
      row.querySelector('input').value = found.path;
      if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(found.method)) row.querySelector('select').value = found.method;
    }
    refreshTestEndpointList();
    const origins = [...new Set(lastDetection.map((entry) => entry.origin).filter(Boolean))];
    const summary = `${lastDetection.length} path terdeteksi · ${origins.length} host`; 
    el('gc-api-detect-summary').textContent = summary;
    el('gc-api-detected').hidden = false;
    el('gc-api-detected').textContent = lastDetection.length
      ? lastDetection.slice(0, 80).map((entry) => `${entry.method} ${entry.path}  [${entry.id}]  ${entry.origin || ''}  (${entry.source})`).join('\n')
      : 'Belum ada endpoint yang dapat dipetakan. Anda dapat mengisi path secara manual.';
    setStatus(`Deteksi selesai: ${summary}. Path hasil deteksi hanya mengisi field yang dikenali; periksa sebelum menyimpan.`, lastDetection.length ? 'ok' : 'warn');
  } catch (error) { setStatus(error.message || String(error), 'error'); }
  finally { setBusy(false); }
}

function appendGeneratedFiles(files, generated) {
  const output = { ...files, ...generated };
  return output;
}

async function saveArtifacts(alsoDownload = false) {
  const apiBridge = bridge();
  const config = readForm();
  const files = await readWorkspace();
  const apiMap = await existingApiMap(files);
  const generated = buildHostingArtifacts(config, apiMap);
  await apiBridge.writeFiles(generated);
  if (alsoDownload) await apiBridge.download(`hosting-${config.gameId || 'game-demo'}.zip`);
  window.__GC_LAST_API_BASE = normalizeApiBase(config.baseUrl);
  return { config, generated, files: appendGeneratedFiles(files, generated) };
}

function showValidation(report) {
  const box = el('gc-api-validation');
  box.hidden = false;
  const rows = [
    `<strong class="${report.status === 'READY' ? 'good' : report.status === 'WARN' ? 'warn' : 'bad'}">Status: ${esc(report.status)}</strong>`,
    ...report.blockers.map((issue) => `<div class="bad">BLOCKER · ${esc(issue.message)}${issue.path ? ` (${esc(issue.path)})` : ''}</div>`),
    ...report.issues.map((issue) => `<div class="warn">PERIKSA · ${esc(issue.message)}</div>`),
    `<div>Entrypoint: ${report.checks.entrypoint ? 'OK' : 'tidak ada'} · aset: ${report.checks.assetCount} · endpoint: ${report.checks.endpoints} · secret literal: ${report.checks.secretFindings}</div>`,
    `<div>File: ${Object.entries(report.checks.files).map(([name, ok]) => `${name}=${ok ? 'OK' : 'missing'}`).join(' · ')}</div>`,
    `<div>Host lama yang diperiksa: ${report.checks.legacyOriginsScanned.map(esc).join(', ') || 'tidak ada'}</div>`
  ];
  box.innerHTML = rows.join('');
  return report;
}

async function validate(packageAfterGenerate = false) {
  setBusy(true); setStatus('Memeriksa endpoint, URL lama, secret, asset, dan file hosting…');
  try {
    let config = readForm();
    let files = await readWorkspace();
    if (packageAfterGenerate) {
      const apiMap = await existingApiMap(files);
      files = appendGeneratedFiles(files, buildHostingArtifacts(config, apiMap));
    }
    const report = showValidation(validateHostingPackage(files, config));
    setStatus(report.status === 'READY' ? 'Semua gate lulus. Paket dapat ditandai Ready Hosting; deployment server tetap langkah terpisah.' : `${report.blockers.length} blocker · ${report.issues.length} catatan. Perbaiki lalu validasi ulang.`, report.status === 'READY' ? 'ok' : report.status === 'WARN' ? 'warn' : 'error');
    return report;
  } catch (error) { setStatus(error.message || String(error), 'error'); return null; }
  finally { setBusy(false); }
}

async function testEndpoint() {
  setBusy(true);
  const output = el('gc-api-test-result');
  try {
    const config = readForm();
    const base = normalizeApiBase(config.baseUrl);
    const selectedId = el('gc-api-test-endpoint').value;
    const endpoint = config.endpoints.find((entry) => entry.id === selectedId);
    if (!endpoint) throw new Error('Pilih endpoint yang valid.');
    const url = new URL(`${base.replace(/\/+$/, '')}${endpoint.path}`);
    if (url.origin !== new URL(base).origin) throw new Error('Path endpoint tidak boleh keluar dari base URL.');
    const headers = Object.fromEntries(Object.entries(config.headers || {}).map(([key, value]) => [key, String(value)]));
    let method = endpoint.method;
    let requestBody;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      if (!el('gc-api-allow-write').checked) method = 'OPTIONS';
      else {
        const confirmed = window.confirm(`Kirim ${endpoint.method} ke ${url.href}? Request tulis dapat membuat session atau mengubah state backend. Lanjut hanya jika ini backend demo/staging milik Anda.`);
        if (!confirmed) { output.textContent = 'Test dibatalkan. Tidak ada request tulis yang dikirim.'; setStatus('Test dibatalkan.', 'warn'); return; }
        method = endpoint.method;
        const parameters = { ...config.parameters };
        if (endpoint.id === 'login') { parameters.username = 'demo-user'; parameters.password = 'demo-password'; }
        if (endpoint.id === 'spin') { parameters.bet_amount = Number(parameters.bet_amount || 1); parameters.game_id = config.gameId; }
        requestBody = JSON.stringify(parameters);
        if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
      }
    }
    output.textContent = `Mengirim ${method} ${url.href}…`;
    const started = performance.now();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 12000) : null;
    let response;
    try {
      response = await fetch(url.href, { method, headers, body: requestBody, mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store', ...(controller ? { signal: controller.signal } : {}) });
    } finally { if (timeout) clearTimeout(timeout); }
    const elapsed = Math.round(performance.now() - started);
    const contentType = response.headers.get('content-type') || '';
    let responsePreview = '';
    try {
      const body = await response.text();
      responsePreview = body.slice(0, 3500);
      if (contentType.includes('json') && responsePreview) {
        try { responsePreview = JSON.stringify(JSON.parse(responsePreview), null, 2); } catch { /* show raw */ }
      }
    } catch { responsePreview = '(body tidak dapat dibaca)'; }
    output.textContent = `${method} ${url.href}\nHTTP ${response.status} ${response.statusText} · ${elapsed} ms\nContent-Type: ${contentType || '(tidak ada)'}\n\n${responsePreview || '(body kosong)'}`;
    setStatus(response.ok ? `Endpoint merespons HTTP ${response.status}. Periksa field response secara manual.` : `Endpoint merespons HTTP ${response.status}. Periksa URL, CORS, method, dan auth.`, response.ok ? 'ok' : 'warn');
  } catch (error) {
    output.textContent = `${error.name || 'Error'}: ${error.message || String(error)}\n\nRequest gagal atau diblokir browser (mis. CORS, DNS, TLS, mixed content). Tidak ada credential otomatis yang ditambahkan.`;
    setStatus(`Test API gagal: ${error.message || error}`, 'error');
  } finally { setBusy(false); }
}

async function copyConfig() {
  const config = readForm();
  const contract = buildApiContract(config);
  const text = JSON.stringify({ base_url: contract.base_url, game_id: contract.game_id, endpoints: contract.endpoints, headers: contract.headers, parameters: contract.parameters, request_fields: contract.request_fields, response_fields: contract.response_fields, environment_variables: contract.environment_variables.map((item) => item.name) }, null, 2);
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else throw new Error('Clipboard API tidak tersedia');
  } catch (_) {
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(area); area.select();
    const copied = document.execCommand('copy'); area.remove();
    if (!copied) throw new Error('Clipboard tidak tersedia di WebView ini.');
  }
  setStatus('Konfigurasi tersalin. Pastikan tidak menambahkan token/secret sebelum membagikan.', 'ok');
}

async function handleAction(action) {
  try {
    if (action === 'detect') return await detect();
    if (action === 'test') return await testEndpoint();
    if (action === 'copy') return await copyConfig();
    if (action === 'contract') {
      setBusy(true); const { config } = await saveArtifacts(false); setStatus(`API Contract dibuat untuk ${config.endpoints.length} endpoint dan disimpan dalam Workspace/hosting/api-contract.json.`, 'ok'); return;
    }
    if (action === 'save') {
      setBusy(true); const { config } = await saveArtifacts(false); setStatus(`Workspace tersimpan: hosting-config.json, api-map.json, hosting/api-contract.json, manifest, README, env.example, dan checklist.`, 'ok'); return;
    }
    if (action === 'package') {
      setBusy(true); const { config } = await saveArtifacts(true); setStatus(`Paket ZIP hosting-${config.gameId || 'game-demo'}.zip dibuat. Ini paket konfigurasi/dokumentasi; belum men-deploy server.`, 'ok'); return;
    }
    if (action === 'validate') return await validate(true);
    if (action === 'ready') {
      await saveArtifacts(false);
      const report = await validate(true);
      if (!report || report.status !== 'READY') return;
      const config = readForm();
      const apiBridge = bridge();
      apiBridge.writeFiles({ 'hosting-ready.json': JSON.stringify({ status: 'READY', validated_at: new Date().toISOString(), game_id: config.gameId, contract: 'hosting/api-contract.json', note: 'Contract package validated; backend deployment is a separate operation.' }, null, 2) + '\n' });
      setStatus('READY HOSTING: pemeriksaan lokal lulus. Paket bisa diunduh; backend/domain tidak di-deploy otomatis dan APK release tidak diubah.', 'ok');
      return;
    }
    if (action === 'rewrite') {
      const config = readForm();
      window.__GC_LAST_API_BASE = normalizeApiBase(config.baseUrl);
      closeModal();
      if (typeof window.autoCustomApiSdk === 'function') window.autoCustomApiSdk();
      else throw new Error('URL rewrite lama belum tersedia di halaman ini.');
    }
  } catch (error) { setStatus(error.message || String(error), 'error'); }
  finally { setBusy(false); }
}

function closeModal() {
  const modal = el(modalId);
  if (modal) modal.classList.remove('open');
  document.body.classList.remove('gc-api-modal-open');
}

export async function openCustomApiManager() {
  const apiBridge = bridge();
  if (!apiBridge?.getZip()) { window.alert('Load ZIP ke Workspace terlebih dahulu.'); return; }
  installStyles();
  const modal = ensureModal();
  modal.classList.add('open');
  document.body.classList.add('gc-api-modal-open');
  try { fillForm(await loadExistingConfig()); setStatus('Siap. Periksa base URL dan endpoint sebelum menyimpan.', 'info'); }
  catch (error) { setStatus(error.message || String(error), 'error'); }
  refreshTestEndpointList();
  el('gc-api-base').focus();
}

window.openCustomApiManager = openCustomApiManager;
window.closeCustomApiManager = closeModal;
