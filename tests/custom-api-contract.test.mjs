import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_ENDPOINTS,
  normalizeApiBase,
  normalizeEndpointConfig,
  detectApiEndpoints,
  buildApiContract,
  buildHostingArtifacts,
  validateHostingPackage
} from '../public/custom-api-contract.js';

test('normalizes HTTPS base URL and rejects credentials / insecure remote HTTP', () => {
  assert.equal(normalizeApiBase('https://api.example.test/v1/'), 'https://api.example.test/v1');
  assert.equal(normalizeApiBase('http://localhost:8787'), 'http://localhost:8787');
  assert.throws(() => normalizeApiBase('http://api.example.test'), /HTTPS/);
  assert.throws(() => normalizeApiBase('https://user:pass@api.example.test'), /Kredensial/);
});

test('provides the six required endpoints and builds a metadata-only contract', () => {
  assert.deepEqual(DEFAULT_ENDPOINTS.map((endpoint) => endpoint.id), ['login', 'session', 'wallet', 'spin', 'result', 'history']);
  const contract = buildApiContract({ baseUrl: 'https://api.example.test', gameId: 'demo-42' });
  assert.equal(contract.base_url, 'https://api.example.test');
  assert.equal(contract.endpoints.length, 6);
  assert.equal(contract.endpoints.find((endpoint) => endpoint.id === 'spin').method, 'POST');
  assert.equal(contract.security.real_money, false);
  assert.equal(contract.environment_variables[0].value, '${API_BASE_URL}');
  assert.equal(contract.authentication.never_embed_token, true);
});

test('detects semantic API paths from api-map and source files', () => {
  const found = detectApiEndpoints({
    'assets/client.js': 'fetch("https://old.example.test/api/wallet/balance"); const spin = "/api/game/spin";'
  }, {
    endpoints: [{ url: 'https://old.example.test/api/auth/login', method_hint: 'POST', kind: 'auth' }]
  });
  assert.ok(found.some((entry) => entry.id === 'login' && entry.path === '/api/auth/login'));
  assert.ok(found.some((entry) => entry.id === 'wallet' && entry.origin === 'https://old.example.test'));
  assert.ok(found.some((entry) => entry.id === 'spin' && entry.path === '/api/game/spin'));
});

test('refuses credential literals in config but accepts environment placeholders', () => {
  assert.throws(() => normalizeEndpointConfig({
    baseUrl: 'https://api.example.test',
    headers: { Authorization: 'Bearer abcdefghijklmnopqrstuvwxyz123456' }
  }), /tidak boleh disimpan/);
  const config = normalizeEndpointConfig({
    baseUrl: 'https://api.example.test',
    headers: { Authorization: 'Bearer ${SESSION_TOKEN}' }
  });
  assert.equal(config.headers.Authorization, 'Bearer ${SESSION_TOKEN}');
});

test('preserves captured api-map endpoints while adding hosting artifacts', () => {
  const originalMap = { version: 1, endpoints: [{ url: 'https://old.example.test/api/spin', kind: 'spin' }], routes: [{ path: '/api/spin' }] };
  const generated = buildHostingArtifacts({ baseUrl: 'https://new.example.test', gameId: 'game-42' }, originalMap);
  const updated = JSON.parse(generated['api-map.json']);
  const config = JSON.parse(generated['hosting-config.json']);
  assert.equal(updated.endpoints.length, 1);
  assert.equal(updated.routes.length, 1);
  assert.equal(updated.customApi.endpoints.length, 6);
  assert.equal(config.game_id, 'game-42');
  assert.ok(generated['hosting/api-contract.json']);
  assert.ok(generated['hosting/manifest.json']);
  assert.match(generated['API_HOSTING_README.md'], /bukan pemulihan server/i);
  assert.match(generated['env.example'], /^API_BASE_URL=$/m);
});

test('hosting readiness passes only when required assets and generated files are present', () => {
  const config = normalizeEndpointConfig({ baseUrl: 'https://api.new.example.test', gameId: 'ready-game' });
  const generated = buildHostingArtifacts(config, { version: 1, endpoints: [{ url: 'https://api.old.example.test/api/auth/login', kind: 'auth' }] });
  const files = {
    ...generated,
    'index.html': '<!doctype html>',
    'assets/logo.png': '[binary asset]',
    'api-map.json': generated['api-map.json']
  };
  const report = validateHostingPackage(files, config);
  assert.equal(report.status, 'READY');
  assert.equal(report.ready, true);
  assert.equal(report.checks.assetCount, 1);
});

test('blocks old captured API origins and detected hard-coded secrets', () => {
  const config = normalizeEndpointConfig({ baseUrl: 'https://api.new.example.test' });
  const generated = buildHostingArtifacts(config, { version: 1, endpoints: [{ url: 'https://api.old.example.test/api/auth/login', kind: 'auth' }] });
  const files = {
    ...generated,
    'index.html': '<!doctype html>',
    'assets/logo.png': '[binary asset]',
    'client.js': 'const server = "https://api.old.example.test/api/auth/login"; const session_token = "captured-token-value-123456";'
  };
  const report = validateHostingPackage(files, config);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.blockers.some((issue) => issue.code === 'LEGACY_API_URL'));
  assert.ok(report.blockers.some((issue) => issue.code === 'SECRET_DETECTED'));
});

test('generated demo Worker serves demo login, balance, idempotent spin, result, and history', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'czipper-demo-worker-'));
  try {
    const workerPath = join(dir, 'worker.mjs');
    const generated = buildHostingArtifacts({ baseUrl: 'https://api.demo.test' });
    writeFileSync(workerPath, generated['demo-backend/worker.js']);
    const { default: worker } = await import(`${pathToFileURL(workerPath).href}?t=${Date.now()}`);
    const env = { JWT_SECRET: 'test-only-demo-secret-with-more-than-32-characters' };
    const request = (path, method = 'GET', body, token, idempotencyKey) => new Request(`https://demo.test${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let response = await worker.fetch(request('/api/auth/login', 'POST', { username: 'demo', password: 'demo' }), env);
    assert.equal(response.status, 200);
    const login = await response.json();
    assert.equal(login.balance, 10000);
    assert.ok(login.session_token);
    response = await worker.fetch(request('/api/wallet/balance', 'GET', null, login.session_token), env);
    assert.equal((await response.json()).balance, 10000);
    response = await worker.fetch(request('/api/game/spin', 'POST', { bet_amount: 10, game_id: 'test' }, login.session_token, 'round-test'), env);
    const spin = await response.json();
    assert.equal(response.status, 200);
    response = await worker.fetch(request('/api/game/spin', 'POST', { bet_amount: 10, game_id: 'test' }, login.session_token, 'round-test'), env);
    assert.equal((await response.json()).round_id, spin.round_id);
    response = await worker.fetch(request(`/api/game/result?round_id=${spin.round_id}`, 'GET', null, login.session_token), env);
    assert.equal((await response.json()).round_id, spin.round_id);
    response = await worker.fetch(request('/api/game/history', 'GET', null, login.session_token), env);
    assert.equal((await response.json()).items.length, 1);
    response = await worker.fetch(request('/api/game/spin', 'POST', { bet_amount: 0 }, login.session_token), env);
    assert.equal(response.status, 400);
    response = await worker.fetch(request('/api/auth/login', 'POST', { username: 'wrong', password: 'wrong' }), env);
    assert.equal(response.status, 401);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('preview diagnostics use textContent rather than dynamic HTML injection', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('<script>\n(function () {\n  var entries = [];\n  var selected = null;');
  assert.notEqual(start, -1);
  const end = html.indexOf('</script>', start);
  const diagnosticsScript = html.slice(start, end);
  assert.ok(diagnosticsScript.includes('kind.textContent = item.kind'));
  assert.ok(diagnosticsScript.includes('title.textContent = item.title'));
  assert.ok(diagnosticsScript.includes('file.textContent = item.file'));
  assert.ok(!diagnosticsScript.includes('innerHTML'));
});
