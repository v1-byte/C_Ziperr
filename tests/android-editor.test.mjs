import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../android-app/app/index.tsx', import.meta.url), 'utf8');
const appConfig = JSON.parse(await readFile(new URL('../android-app/app.json', import.meta.url), 'utf8'));

test('Android APK opens C.Ziperr through the c-zipper Worker', () => {
  assert.match(source, /c-zipper\.corelink-ai\.workers\.dev/);
  assert.match(source, /<WebView/);
  assert.match(source, /javaScriptEnabled/);
  assert.match(source, /domStorageEnabled/);
});

test('Android APK has a visible network failure fallback', () => {
  assert.match(source, /Web utama tidak dapat dibuka/);
  assert.match(source, /Coba lagi/);
  assert.match(source, /Buka di browser/);
});

test('Android APK does not load the old native ZIP application at startup', () => {
  assert.doesNotMatch(source, /ZipPreviewScreen|DocumentPicker|expo-av|JSZip|KeyboardProvider/);
});

test('Android WebView cache-buster follows the native APK version', () => {
  assert.ok(Number.isInteger(appConfig.expo.android.versionCode));
  assert.ok(source.includes('app_release=' + appConfig.expo.version));
});

console.log('Android web-wrapper regression test passed');
