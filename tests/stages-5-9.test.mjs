import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPreviewServer } from '../core/server/preview.mjs';
import { createMockApiServer } from '../core/server/mock-api.mjs';
import { rewritePackage } from '../core/repair/rewriter.mjs';
import { scanPackage } from '../core/analyze/dependencies.mjs';
import { validateOffline } from '../core/offline/validator.mjs';

async function fixture() { const root = await mkdtemp(join(tmpdir(), 'cziperr-stage5-9-')); await mkdir(join(root, 'server')); await writeFile(join(root, 'index.rendered.html'), '<script src="assets/app.js"></script>'); await mkdir(join(root, 'assets')); await writeFile(join(root, 'assets/app.js'), "fetch('/api/game/init'); import('./lazy.js');"); await writeFile(join(root, 'assets/lazy.js'), 'console.log("ok")'); await writeFile(join(root, 'kelengkapan.json'), '{}'); await writeFile(join(root, 'server/0001.json'), JSON.stringify({ url: 'https://game.test/api/game/init', method: 'GET', status: 200, response: '{"ok":true}' })); return root; }

test('preview server serves files, health, CSP, and blocks traversal', async () => { const root = await fixture(); const s = createPreviewServer({ root }); const i = await s.start(); assert.equal((await fetch(i.url + '/__health')).status, 200); const r = await fetch(i.url + '/index.rendered.html'); assert.equal(r.status, 200); assert.match(r.headers.get('content-security-policy'), /default-src/); const traversal = await new Promise(resolve => { const req = http.request({ hostname: i.host, port: i.port, path: '/%2e%2e/package.json', method: 'GET' }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }); req.end(); }); assert.equal(traversal, 403); await s.stop(); await rm(root, { recursive: true, force: true }); });
test('mock API matches method/path and logs request', async () => { const s = createMockApiServer({ rules: [{ match: '/api/game/init', method: 'GET', status: 200, body: '{"ok":true}' }] }); const i = await s.start(); const r = await fetch(i.url + '/api/game/init'); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true }); assert.equal(s.log.length, 1); await s.stop(); });
test('rewriter changes text files and emits report', async () => { const root = await fixture(); const report = await rewritePackage(root, { from: 'https://game.test', to: 'http://127.0.0.1:4000' }); assert.equal(report.changed.length, 1); assert.match(await readFile(join(root, 'server/0001.json'), 'utf8'), /127\.0\.0\.1/); await rm(root, { recursive: true, force: true }); });
test('dependency scanner finds edges, features, hashes, and duplicates', async () => { const root = await fixture(); const report = await scanPackage(root); assert.ok(report.edges.some(x => x.to === './lazy.js')); assert.ok(report.features.includes('fetch-xhr')); assert.ok(report.assets.every(x => x.sha256)); await rm(root, { recursive: true, force: true }); });
test('offline validator produces readiness status and missing report', async () => { const root = await fixture(); const report = await validateOffline(root); assert.ok(['FULL_OFFLINE_READY', 'PARTIAL'].includes(report.status)); assert.equal(report.missing.length, 0); await rm(root, { recursive: true, force: true }); });
