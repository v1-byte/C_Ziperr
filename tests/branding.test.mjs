import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8');
const androidConfig = JSON.parse(readFileSync(new URL('../android-app/app.json', import.meta.url), 'utf8'));

test('APK WebView and PWA use C.Ziperr branding instead of Frostbyte/Firstbyte labels', () => {
  assert.match(html, /<title>C\.Ziperr[^<]*<\/title>/);
  assert.match(html, /<div class="brand">C\.Ziperr<\/div>/);
  assert.doesNotMatch(html, /Frostbyte|Firstbyte|frosbyte|frostbyte@collector|frostbyte-lab\/Edu-network/);
  assert.match(manifest, /"name": "C\.Ziperr"/);
  assert.doesNotMatch(manifest, /Frostbyte|Firstbyte|frosbyte/i);
  assert.equal(androidConfig.expo.name, 'C.Ziperr');
});
