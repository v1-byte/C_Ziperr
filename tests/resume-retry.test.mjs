import test from 'node:test';
import assert from 'node:assert/strict';
import { resumeFetchMissing } from '../src/collect/resume.js';

test('resume retries missing URL even when persisted seen contains the failed URL', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), {
    status: 200, headers: { 'content-type': 'image/png' }
  });
  t.after(() => { globalThis.fetch = originalFetch; });
  const seen = new Set(['https://example.test/a.png']);
  const files = {};
  const manifest = [];
  const report = await resumeFetchMissing([{ url: 'https://example.test/a.png' }], seen, files, manifest, 'https://example.test/', 1);
  assert.equal(report.attempted, 1);
  assert.equal(report.fetched, 1);
  assert.equal(report.stillMissing.length, 0);
  assert.equal(manifest.length, 1);
});

test('resume enforces maxFetch against attempted requests', async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('no', { status: 503 }); };
  t.after(() => { globalThis.fetch = originalFetch; });
  const report = await resumeFetchMissing(['https://example.test/a.png', 'https://example.test/b.png'], new Set(), {}, [], 'https://example.test/', 1);
  assert.ok(calls <= 3);
  assert.equal(report.attempted, 1);
  assert.equal(report.stillMissing.length, 2);
});
