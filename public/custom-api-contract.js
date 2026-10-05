const REQUIRED_ENDPOINTS = [
  { id: 'login', label: 'Login', method: 'POST', path: '/api/auth/login' },
  { id: 'session', label: 'Session', method: 'GET', path: '/api/session' },
  { id: 'wallet', label: 'Wallet / Balance', method: 'GET', path: '/api/wallet/balance' },
  { id: 'spin', label: 'Game / Spin', method: 'POST', path: '/api/game/spin' },
  { id: 'result', label: 'Result', method: 'GET', path: '/api/game/result' },
  { id: 'history', label: 'History', method: 'GET', path: '/api/game/history' }
];

export const DEFAULT_REQUEST_FIELDS = ['username', 'password', 'session_token', 'bet_amount', 'game_id'];
export const DEFAULT_RESPONSE_FIELDS = ['ok', 'session_token', 'balance', 'result', 'round_id', 'timestamp'];
export const DEFAULT_ENVIRONMENT = ['API_BASE_URL', 'JWT_SECRET', 'DATABASE_URL', 'SIGNING_KEY'];
export const DEFAULT_ENDPOINTS = REQUIRED_ENDPOINTS.map((endpoint) => ({ ...endpoint }));

const SECRET_VALUE_PATTERNS = [
  { id: 'private-key', label: 'private key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { id: 'jwt', label: 'JWT/token literal', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { id: 'bearer', label: 'Bearer credential', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i },
  { id: 'secret-assignment', label: 'hard-coded secret/token', re: /(?:jwt[_-]?secret|signing[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?token|api[_-]?key)\s*["']?\s*[:=]\s*["'](?!\$\{)[^"'\s]{12,}["']/i }
];

const DEMO_BACKEND_SOURCE = String.raw`// C.Ziperr Custom API demo — non-monetary, in-memory, NOT production-ready.
// Deploy only to an isolated demo/staging environment that you control.
const players = new Map();
const rounds = new Map();
const idempotency = new Map();
const encoder = new TextEncoder();
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
const error = (message, status = 400) => json({ ok: false, error: message, timestamp: new Date().toISOString() }, status);
function b64urlBytes(bytes) { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function decodeB64url(value) { const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)); return Uint8Array.from(raw, (char) => char.charCodeAt(0)); }
async function hmacKey(secret) { if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters'); return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
async function issueToken(playerId, secret) { const header = b64urlBytes(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))); const payload = b64urlBytes(encoder.encode(JSON.stringify({ sub: playerId, exp: Math.floor(Date.now() / 1000) + 3600 }))); const input = header + '.' + payload; const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(input))); return input + '.' + b64urlBytes(signature); }
async function readToken(request, secret) { const match = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i); if (!match) return null; try { const parts = match[1].split('.'); if (parts.length !== 3) return null; const input = parts[0] + '.' + parts[1]; const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), decodeB64url(parts[2]), encoder.encode(input)); if (!valid) return null; const payload = JSON.parse(new TextDecoder().decode(decodeB64url(parts[1]))); return payload.exp > Date.now() / 1000 ? payload.sub : null; } catch (_) { return null; } }
async function body(request) { const text = await request.text(); if (text.length > 65536) throw new Error('Request body too large'); return text ? JSON.parse(text) : {}; }
function now() { return new Date().toISOString(); }
async function signValue(value, secret) {
  if (!secret || secret.length < 32) throw new Error('SIGNING_KEY must be configured with at least 32 characters');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64urlBytes(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
async function verifyLicenseToken(token, secret) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeB64url(parts[0])));
    const valid = parts[1] === await signValue(parts[0], secret);
    return valid && payload.exp > Date.now() / 1000 ? payload : null;
  } catch (_) { return null; }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '600' } });
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      let input; try { input = await body(request); } catch (e) { return error(e.message); }
      if (String(input.username || '') !== 'demo' || String(input.password || '') !== 'demo') return error('Use demo/demo on this demo server', 401);
      const playerId = 'demo-player';
      if (!players.has(playerId)) players.set(playerId, { balance: 10000, created_at: now() });
      let token; try { token = await issueToken(playerId, env.JWT_SECRET); } catch (e) { return error(e.message, 500); }
      return json({ ok: true, session_token: token, balance: players.get(playerId).balance, result: null, round_id: null, timestamp: now() });
    }
    if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true, demo: true, persistent: false, license: 'new-server', signing: 'HMAC-SHA256', timestamp: now() });
    if (url.pathname === '/api/license/verify' && request.method === 'POST') {
      let input; try { input = await body(request); } catch (e) { return error(e.message); }
      if (env.DEMO_ONLY === 'true' && input.license_token === 'demo-license') return json({ ok: true, licensed: true, mode: 'demo', expires_at: null, timestamp: now() });
      const license = await verifyLicenseToken(input.license_token, env.SIGNING_KEY || '');
      return license ? json({ ok: true, licensed: true, mode: 'server-new', subject: license.sub, expires_at: license.exp, timestamp: now() }) : error('License baru tidak valid atau kedaluwarsa', 403);
    }
    const playerId = await readToken(request, env.JWT_SECRET);
    if (!playerId || !players.has(playerId)) return error('Session invalid or expired', 401);
    const player = players.get(playerId);
    if (url.pathname === '/api/session' && request.method === 'GET') return json({ ok: true, session_token: 'redacted; send bearer token in Authorization header', balance: player.balance, timestamp: now() });
    if (url.pathname === '/api/wallet/balance' && request.method === 'GET') return json({ ok: true, balance: player.balance, currency: 'DEMO_CREDIT', timestamp: now() });
    if (url.pathname === '/api/game/spin' && request.method === 'POST') {
      let input; try { input = await body(request); } catch (e) { return error(e.message); }
      const idem = request.headers.get('Idempotency-Key');
      if (idem && idempotency.has(playerId + ':' + idem)) return json(idempotency.get(playerId + ':' + idem));
      const bet = Number(input.bet_amount);
      if (!Number.isSafeInteger(bet) || bet < 1 || bet > 500) return error('bet_amount must be an integer from 1 to 500');
      if (bet > player.balance) return error('Insufficient demo balance', 409);
      player.balance -= bet;
      const roll = crypto.getRandomValues(new Uint32Array(1))[0] % 20;
      const win = roll === 0 ? bet * 5 : roll < 4 ? bet * 2 : 0;
      player.balance += win;
      const roundId = crypto.randomUUID();
      const result = { round_id: roundId, game_id: String(input.game_id || 'game-demo'), bet_amount: bet, win_amount: win, symbols: [roll % 7, (roll + 2) % 7, (roll + 4) % 7], balance: player.balance, timestamp: now() };
      rounds.set(roundId, { playerId, result });
      const response = { ok: true, result, round_id: roundId, balance: player.balance, result_signature: await signValue(JSON.stringify(result), env.SIGNING_KEY || env.JWT_SECRET || ''), timestamp: result.timestamp };
      if (idem) idempotency.set(playerId + ':' + idem, response);
      return json(response);
    }
    if (url.pathname === '/api/game/result' && request.method === 'GET') {
      const record = rounds.get(url.searchParams.get('round_id'));
      if (!record || record.playerId !== playerId) return error('Round not found', 404);
      return json({ ok: true, result: record.result, round_id: record.result.round_id, balance: player.balance, result_signature: await signValue(JSON.stringify(record.result), env.SIGNING_KEY || env.JWT_SECRET || ''), timestamp: now() });
    }
    if (url.pathname === '/api/game/history' && request.method === 'GET') {
      const items = [...rounds.values()].filter((record) => record.playerId === playerId).map((record) => record.result).slice(-100).reverse();
      return json({ ok: true, items, balance: player.balance, timestamp: now() });
    }
    return error('Not found', 404);
  }
};
`;

function safeString(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizeApiBase(value) {
  const raw = safeString(value, 2048).replace(/\/+$/, '');
  if (!raw) return '';
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('Base URL harus berupa URL absolut yang valid.'); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Base URL hanya boleh memakai HTTP/HTTPS.');
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('Gunakan HTTPS; HTTP hanya diizinkan untuk localhost.');
  }
  if (parsed.username || parsed.password) throw new Error('Kredensial tidak boleh ditanam di URL.');
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

export function normalizeEndpointConfig(input = {}) {
  const base = DEFAULT_ENDPOINTS.map((defaults) => {
    const found = (input.endpoints || []).find((entry) => entry.id === defaults.id) || {};
    const method = safeString(found.method || defaults.method, 10).toUpperCase();
    const path = safeString(found.path || defaults.path, 500);
    return { ...defaults, method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? method : defaults.method, path };
  });
  const headers = input.headers && typeof input.headers === 'object' && !Array.isArray(input.headers) ? input.headers : { 'Content-Type': 'application/json' };
  const parameters = input.parameters && typeof input.parameters === 'object' && !Array.isArray(input.parameters) ? input.parameters : { game_id: '${GAME_ID}' };
  const sensitiveKey = /authorization|token|secret|password|api[_-]?key|signing[_-]?key/i;
  for (const [key, value] of [...Object.entries(headers), ...Object.entries(parameters)]) {
    if (sensitiveKey.test(key) && typeof value === 'string' && value && !/^Bearer\s+\$\{[A-Z0-9_]+\}$/.test(value) && !/^\$\{[A-Z0-9_]+\}$/.test(value)) {
      throw new Error('Nilai sensitif untuk "' + key + '" tidak boleh disimpan ke ZIP. Gunakan placeholder environment, mis. Bearer ${SESSION_TOKEN}.');
    }
  }
  return {
    version: 1,
    baseUrl: safeString(input.baseUrl, 2048),
    gameId: safeString(input.gameId || 'game-demo', 100),
    endpoints: base,
    headers,
    parameters,
    requestFields: Array.isArray(input.requestFields) ? input.requestFields.map((v) => safeString(v, 100)).filter(Boolean) : [...DEFAULT_REQUEST_FIELDS],
    responseFields: Array.isArray(input.responseFields) ? input.responseFields.map((v) => safeString(v, 100)).filter(Boolean) : [...DEFAULT_RESPONSE_FIELDS],
    responseFormat: safeString(input.responseFormat || 'json', 40).toLowerCase(),
    auth: { type: 'bearer', tokenEnv: 'SESSION_TOKEN' }
  };
}

export function detectApiEndpoints(files = {}, apiMap = null) {
  const found = new Map();
  const add = (record) => {
    const path = safeString(record.path || record.url, 500);
    if (!path) return;
    let pathname = path;
    let origin = '';
    try {
      const url = new URL(path, 'https://local.invalid');
      pathname = url.pathname;
      origin = url.origin === 'https://local.invalid' ? '' : url.origin;
    } catch { /* keep source string */ }
    const text = `${record.kind || ''} ${record.label || ''} ${pathname}`.toLowerCase();
    let id = record.id;
    if (!id) {
      if (/auth|login|signin|verify.*session/.test(text)) id = 'login';
      else if (/session|token/.test(text)) id = 'session';
      else if (/wallet|balance|credit/.test(text)) id = 'wallet';
      else if (/spin|play|bet|wager/.test(text)) id = 'spin';
      else if (/result|settle|round/.test(text)) id = 'result';
      else if (/history|record/.test(text)) id = 'history';
      else id = 'other';
    }
    const key = `${id}|${pathname.toLowerCase()}`;
    if (!found.has(key)) found.set(key, {
      id,
      label: REQUIRED_ENDPOINTS.find((item) => item.id === id)?.label || 'API terdeteksi',
      method: safeString(record.method || record.method_hint, 10).toUpperCase() || 'GET',
      path: pathname.startsWith('/') ? pathname : `/${pathname}`,
      origin,
      source: record.source || 'scan'
    });
  };

  for (const endpoint of apiMap?.endpoints || []) {
    add({ ...endpoint, method: endpoint.contract?.method || endpoint.method || endpoint.method_hint, source: 'api-map' });
  }
  for (const [filePath, contents] of Object.entries(files || {})) {
    if (!/\.(?:html?|m?js|cjs|ts|tsx|json|ya?ml|txt)$/i.test(filePath)) continue;
    const text = typeof contents === 'string' ? contents : '';
    if (!text) continue;
    const patterns = [
      /(?:https?:\/\/[^\s"'`<>]+)?\/api\/[A-Za-z0-9_./:{}-]+/g,
      /(?:fetch|axios\.(?:get|post|put|delete)|\.open)\s*\(\s*["'`]([^"'`]+)["'`]/gi
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text))) {
        const value = match[1] || match[0];
        if (/\/api\//i.test(value)) add({ path: value, source: filePath });
        if (pattern.lastIndex === match.index) pattern.lastIndex++;
      }
    }
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id) || a.path.localeCompare(b.path));
}

export function buildApiContract(input = {}) {
  const config = normalizeEndpointConfig(input);
  const baseUrl = normalizeApiBase(config.baseUrl);
  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    purpose: 'Custom API hosting contract; use only with a backend you own or are authorized to operate.',
    mode: 'demo-or-owner-operated-backend',
    base_url: baseUrl,
    game_id: config.gameId,
    authentication: { type: 'bearer', token_env: 'SESSION_TOKEN', never_embed_token: true },
    request_fields: config.requestFields,
    response_fields: config.responseFields,
    response_format: config.responseFormat,
    headers: config.headers,
    parameters: config.parameters,
    endpoints: config.endpoints.map(({ id, label, method, path }) => ({ id, label, method, path, url: `${baseUrl}${path}`, required: true })),
    environment_variables: DEFAULT_ENVIRONMENT.map((name) => ({ name, required: true, value: '${' + name + '}' })),
    security: {
      credentials_are_environment_only: true,
      server_authoritative_balance_and_results: true,
      idempotency_header: 'Idempotency-Key',
      never_reuse_legacy_tokens_or_private_keys: true,
      real_money: false
    }
  };
}

function toJson(value) { return JSON.stringify(value, null, 2) + '\n'; }

export function buildHostingArtifacts(input = {}, existingApiMap = null) {
  const config = normalizeEndpointConfig(input);
  const contract = buildApiContract(config);
  const oldMap = existingApiMap && typeof existingApiMap === 'object' ? existingApiMap : { version: 1, endpoints: [], routes: [] };
  const apiMap = {
    ...oldMap,
    version: oldMap.version || 1,
    customApi: { baseUrl: contract.base_url, gameId: config.gameId, endpoints: contract.endpoints },
    hosting: { contract: 'hosting/api-contract.json', config: 'hosting-config.json', updatedAt: new Date().toISOString() }
  };
  const hostingConfig = {
    schema_version: '1.0',
    app: 'C.Ziperr Custom API Workspace',
    mode: 'demo-or-owner-operated-backend',
    base_url: contract.base_url,
    game_id: config.gameId,
    endpoints: contract.endpoints,
    headers: config.headers,
    parameters: config.parameters,
    request_fields: config.requestFields,
    response_fields: config.responseFields,
    response_format: config.responseFormat,
    auth: contract.authentication,
    environment_variables: DEFAULT_ENVIRONMENT,
    notes: ['Demo/test config only; not a live payment or real-money backend.', 'Do not place secrets, session tokens, signing keys, or private keys in this file.']
  };
  const packageManifest = {
    schema_version: '1.0',
    package_name: config.gameId,
    package_type: 'custom-api-hosting-contract',
    generated_at: new Date().toISOString(),
    entrypoint: 'index.html',
    api_contract: 'hosting/api-contract.json',
    api_map: 'api-map.json',
    config: 'hosting-config.json',
    demo_backend: 'demo-backend/worker.js',
    source_files_preserved: true,
    demo_only: true,
    license_service: 'demo-backend/worker.js#/api/license/verify',
    signing: 'HMAC-SHA256 via SIGNING_KEY',
    offline_mode: 'local-demo-only'
  };
  const activity = {
    schema_version: '1.0',
    events: [{
      event: 'custom_api_contract_generated',
      created_at: new Date().toISOString(),
      game_id: config.gameId,
      base_url: contract.base_url,
      endpoints: contract.endpoints.map(({ id, method, path }) => ({ id, method, path })),
      required_environment_variables: DEFAULT_ENVIRONMENT,
      credentials_included: false,
      live_backend_deployed: false
    }]
  };
  const envExample = DEFAULT_ENVIRONMENT.map((name) => `${name}=`).join('\n') + '\nSESSION_TOKEN=\n';
  const readme = [
    `# API Hosting Contract — ${config.gameId}`,
    '',
    '> Template untuk backend demo atau server yang Anda miliki/berwenang kelola. Bukan pemulihan server, saldo, token, RNG, DRM, atau lisensi lama.',
    '',
    `Base URL: ${contract.base_url}`,
    '',
    '## Endpoint wajib',
    ...contract.endpoints.map((endpoint) => `- \`${endpoint.method} ${endpoint.path}\` — ${endpoint.label}`),
    '',
    `Request fields: ${config.requestFields.map((field) => `\`${field}\``).join(', ')}`,
    '',
    `Response fields: ${config.responseFields.map((field) => `\`${field}\``).join(', ')}`,
    '',
    '## Demo backend opsional',
    '- Scaffold tersedia di `demo-backend/worker.js` dengan config `demo-backend/wrangler.jsonc`.',
    '- Jalankan hanya sebagai demo non-monetary: login `demo` / `demo`, saldo demo 10.000 kredit, data tersimpan sementara di memori isolate dan dapat hilang saat restart.',
    '- Sebelum menjalankan lokal, set `JWT_SECRET` minimal 32 karakter melalui secret manager; jangan menaruh nilainya ke repository/ZIP.',
    '- Scaffold ini bukan production backend: belum memakai database, CORS dibuka untuk demo, dan tidak cocok untuk saldo atau taruhan uang nyata.',
    '- License server baru: `POST /api/license/verify`; demo menerima `demo-license`, server milik Anda memakai HMAC `SIGNING_KEY`.',
    '- Hasil spin dilengkapi `result_signature`; verifikasi signature pada server/client yang Anda kontrol.',
    '- `offline-config.json` hanya mengaktifkan mode demo lokal; tidak melewati DRM, license, token, atau signature server lama.',
    '',
    '## Variabel lingkungan',
    ...DEFAULT_ENVIRONMENT.map((name) => `- \`${name}\` — isi hanya pada environment/secret manager server; jangan commit nilainya.`),
    '- `SESSION_TOKEN` — runtime session, tidak disimpan ke paket.',
    '',
    '## Batasan',
    '- Kontrak ini mendeskripsikan integrasi. Ia tidak mengimplementasikan atau menerbitkan backend live.',
    '- Untuk demo, gunakan saldo/RNG non-monetary dan data sintetis.',
    '- Hasil dan saldo harus dihitung/ditandatangani server; jangan percaya nilai dari client.',
    '- Uji POST spin hanya pada backend demo/staging yang Anda kontrol.',
    ''
  ].join('\n');
  const checklist = [
    '# Server Checklist', '',
    '- [ ] Deploy backend Anda sendiri melalui proses yang berwenang.',
    '- [ ] Jika memakai scaffold, batasi ke demo/staging; ia memakai state in-memory dan tidak boleh dipakai untuk uang nyata/produksi.',
    '- [ ] Set `API_BASE_URL`, `JWT_SECRET`, `DATABASE_URL`, `SIGNING_KEY` melalui secret manager.',
    '- [ ] Jangan memakai credential/token/private key lama atau menanamkannya ke ZIP/client.',
    '- [ ] Terapkan autentikasi, TLS, validasi input, rate limit, logging tersanitasi, dan idempotency.',
    '- [ ] Saldo, RNG, hasil, dan ledger bersifat server-authoritative; gunakan saldo demo/non-monetary untuk demo.',
    '- [ ] Terapkan seluruh endpoint pada `hosting/api-contract.json` dan validasi schema response.',
    '- [ ] Tambahkan `/api/license/verify`, set `SIGNING_KEY`, dan verifikasi `result_signature`.',
    '- [ ] Jalankan test GET terlebih dahulu; POST spin hanya pada staging/demo milik Anda.',
    '- [ ] Jalankan `Validate Hosting`, periksa semua blocker, lalu uji ZIP hasil ekspor.',
    '- [ ] Siapkan domain/TLS/CORS dan pantau log sebelum hosting.',
    '- [ ] Promosikan paket dengan versioning; jangan menimpa APK rilis.', ''
  ].join('\n');
  return {
    'api-map.json': toJson(apiMap),
    'hosting-config.json': toJson(hostingConfig),
    'hosting/api-contract.json': toJson(contract),
    'hosting/manifest.json': toJson(packageManifest),
    'hosting/activity.json': toJson(activity),
    'demo-backend/worker.js': DEMO_BACKEND_SOURCE,
    'demo-backend/wrangler.jsonc': '{\n  "$schema": "node_modules/wrangler/config-schema.json",\n  "name": "c-ziperr-demo-api",\n  "main": "worker.js",\n  "compatibility_date": "2026-10-04",\n  "vars": { "DEMO_ONLY": "true" }\n}\n',
    'offline-config.json': toJson({ version: 1, mode: 'local-demo-only', apiBase: 'local-demo', license: 'demo-license', legacyOriginsBlocked: true, note: 'Offline demo memakai akun, wallet, RNG, license, dan signature server baru; tidak memulihkan server lama.' }),
    'API_HOSTING_README.md': readme,
    'env.example': envExample,
    'server-checklist.md': checklist
  };
}

export function validateHostingPackage(files = {}, configInput = {}) {
  const config = normalizeEndpointConfig(configInput);
  const entries = Object.keys(files || {}).filter((path) => files[path] !== undefined);
  const issues = [];
  const blockers = [];
  let normalizedBase = '';
  try { normalizedBase = normalizeApiBase(config.baseUrl); }
  catch (error) { blockers.push({ code: 'BASE_URL_INVALID', message: error.message }); }
  if (!normalizedBase) blockers.push({ code: 'BASE_URL_EMPTY', message: 'Base URL backend belum diisi.' });

  const paths = new Set(entries.map((path) => path.replace(/^\.\//, '').toLowerCase()));
  const hasEntry = entries.some((path) => /(^|\/)index\.html?$/i.test(path));
  const assetCount = entries.filter((path) => /\.(?:png|jpe?g|gif|webp|svg|mp3|ogg|wav|woff2?|ttf|atlas|bin|wasm)$/i.test(path)).length;
  if (!hasEntry) blockers.push({ code: 'ENTRYPOINT_MISSING', message: 'index.html tidak ditemukan di ZIP.' });
  if (!assetCount) issues.push({ code: 'ASSETS_NONE', message: 'Belum ditemukan aset game umum; pastikan aset penting memang tersedia.' });
  for (const name of ['api-map.json', 'hosting-config.json', 'hosting/api-contract.json', 'hosting/manifest.json']) {
    if (!paths.has(name.toLowerCase())) blockers.push({ code: 'PACKAGE_FILE_MISSING', message: `${name} belum dibuat.` });
  }
  for (const endpoint of config.endpoints) {
    if (!endpoint.path.startsWith('/') || endpoint.path.includes('://')) blockers.push({ code: 'ENDPOINT_PATH_INVALID', message: `${endpoint.label}: path harus diawali / dan bukan URL absolut.` });
    if (!endpoint.path.trim()) blockers.push({ code: 'ENDPOINT_EMPTY', message: `${endpoint.label}: endpoint wajib kosong.` });
  }
  if (config.responseFormat !== 'json') issues.push({ code: 'RESPONSE_FORMAT_REVIEW', message: `Format response ${config.responseFormat} perlu dikonfirmasi pada backend.` });
  for (const field of DEFAULT_RESPONSE_FIELDS) {
    if (!config.responseFields.includes(field)) blockers.push({ code: 'RESPONSE_FIELD_MISSING', message: `Field response wajib tidak terdaftar: ${field}.` });
  }
  for (const field of DEFAULT_REQUEST_FIELDS) {
    if (!config.requestFields.includes(field)) issues.push({ code: 'REQUEST_FIELD_MISSING', message: `Field request template tidak terdaftar: ${field}.` });
  }

  const textual = Object.entries(files || {}).filter(([path]) => /\.(?:html?|m?js|cjs|css|json|ya?ml|md|txt|env)$/i.test(path));
  const secretFindings = [];
  for (const [path, value] of textual) {
    const text = typeof value === 'string' ? value : '';
    if (!text) continue;
    for (const pattern of SECRET_VALUE_PATTERNS) {
      if (pattern.re.test(text)) secretFindings.push({ code: 'SECRET_DETECTED', path, message: `${pattern.label} ditemukan dalam ${path}.` });
    }
  }
  blockers.push(...secretFindings);

  const legacyOrigins = new Set();
  const legacyApiReferences = [];
  let parsedMap = null;
  try { parsedMap = JSON.parse(files['api-map.json'] || '{}'); } catch { blockers.push({ code: 'API_MAP_INVALID', message: 'api-map.json bukan JSON yang valid.' }); }
  for (const endpoint of parsedMap?.endpoints || []) {
    const url = endpoint.url || '';
    try {
      const parsed = new URL(url);
      if (parsed.origin !== normalizedBase) {
        legacyOrigins.add(parsed.origin);
        legacyApiReferences.push(`${parsed.origin}${parsed.pathname}`.toLowerCase());
      }
    } catch { /* no origin */ }
  }
  for (const [path, value] of textual) {
    if (/^(?:api-map\.json|hosting\/|hosting-config\.json|API_HOSTING_README\.md|server-checklist\.md|env\.example)/i.test(path)) continue;
    const text = typeof value === 'string' ? value : '';
    const lowerText = text.toLowerCase();
    for (const reference of legacyApiReferences) {
      const origin = new URL(reference).origin;
      if (lowerText.includes(reference) || (lowerText.includes(origin.toLowerCase()) && lowerText.includes(new URL(reference).pathname.toLowerCase()))) {
        blockers.push({ code: 'LEGACY_API_URL', path, message: `Referensi endpoint API lama ${reference} masih ditemukan pada ${path}.` });
        break;
      }
    }
  }
  return {
    status: blockers.length ? 'BLOCKED' : issues.length ? 'WARN' : 'READY',
    ready: blockers.length === 0,
    blockers,
    issues,
    checks: {
      entrypoint: hasEntry,
      assetCount,
      endpoints: config.endpoints.length,
      validBaseUrl: Boolean(normalizedBase),
      responseFormat: config.responseFormat,
      files: Object.fromEntries(['api-map.json', 'hosting-config.json', 'hosting/api-contract.json', 'hosting/manifest.json'].map((name) => [name, paths.has(name.toLowerCase())])),
      secretFindings: secretFindings.length,
      legacyOriginsScanned: [...legacyOrigins]
    }
  };
}
