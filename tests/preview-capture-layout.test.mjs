import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('preview analyses only a real ZIP loaded by the user', () => {
  assert.match(html, /Analisis ZIP Workspace/);
  assert.match(html, /Analisis hanya berkas yang benar-benar dimuat/);
  assert.doesNotMatch(html, /Jalankan ZIP contoh|game-contoh\.zip|function stub\(/i);
});

test('collect results show genuine output and do not expose synthetic resource entries', () => {
  assert.match(html, /Hasil collect asli/);
  assert.match(html, /function recordZipResult/);
  assert.match(html, /mock_offline: false/);
  assert.doesNotMatch(html, /resource-\d+|demo-001|respons contoh/i);
});
