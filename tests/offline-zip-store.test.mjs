import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = readFileSync(new URL('../public/offline-zip-store.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('ZIP store is device-local and keeps the latest package metadata', () => {
  assert.match(store, /indexedDB\.open/);
  assert.match(store, /c-ziperr-local-packages/);
  assert.match(store, /meta\.id \|\| 'latest'/);
  assert.doesNotMatch(store, /fetch\(/);
});

test('Workspace exposes saved ZIP reload and preview has a blob fallback', () => {
  assert.match(html, /gcLoadSavedZip\(\)/);
  assert.match(html, /ZIP tersimpan/);
  assert.match(html, /SW cache tidak lengkap/);
  assert.match(html, /fallback blob URL aktif/);
  assert.match(html, /ZIP OFFLINE · NET BLOCKED/);
});

test('Custom API opens without extracting the whole ZIP and Monaco is deferred', () => {
  const manager = readFileSync(new URL('../public/custom-api-manager.js', import.meta.url), 'utf8');
  assert.match(manager, /readWorkspacePaths\(\['hosting-config\.json', 'api-map\.json'\]\)/);
  assert.match(manager, /Custom API siap\. Memuat konfigurasi tersimpan/);
  assert.match(html, /readFiles: async function \(options\)/);
  assert.match(html, /setTimeout\(function\(\) \{ if \(typeof initMonacoEditor/);
  assert.match(html, /\}, 3000\);/);
});
