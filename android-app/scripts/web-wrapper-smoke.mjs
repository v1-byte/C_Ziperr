import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createUpdateManifest } from './create-update-manifest.mjs';

const source = await readFile(new URL('../app/index.tsx', import.meta.url), 'utf8');
const appConfig = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8')).expo;
const workflow = await readFile(new URL('../../.github/workflows/android-apk.yml', import.meta.url), 'utf8');
assert.match(source, /c-zipper\.corelink-ai\.workers\.dev/);
assert.match(source, /<WebView/);
assert.match(source, /javaScriptEnabled/);
assert.match(source, /domStorageEnabled/);
assert.match(source, /Coba lagi/);
assert.match(source, /releases\/latest\/download\/update\.json/);
assert.match(source, /android\.intent\.action\.INSTALL_PACKAGE/);
assert.match(source, /getContentUriAsync/);
assert.match(source, /apkSizeBytes/);
assert.match(source, /AppState\.addEventListener/);
assert.match(workflow, /Verify APK signing certificate continuity/);
assert.match(workflow, /release\/update\.json/);
assert.doesNotMatch(source, /ZipPreviewScreen|DocumentPicker|expo-av|JSZip|KeyboardProvider/);

assert.equal(appConfig.version, '1.2.6');
assert.equal(appConfig.android.versionCode, 13);
assert.ok(appConfig.android.permissions.includes('REQUEST_INSTALL_PACKAGES'));

const manifest = createUpdateManifest({
  appConfig,
  repository: 'v1-byte/C_Ziperr',
  runNumber: '42',
  apkSizeBytes: 64_000_000,
});
assert.equal(manifest.appId, 'com.fblabb.zipscope');
assert.equal(manifest.versionName, '1.2.6');
assert.equal(manifest.versionCode, 13);
assert.equal(manifest.releaseTag, 'apk-42');
assert.equal(manifest.apkSizeBytes, 64_000_000);
assert.equal(manifest.apkUrl, 'https://github.com/v1-byte/C_Ziperr/releases/download/apk-42/app-release.apk');
assert.throws(() => createUpdateManifest({ appConfig, repository: 'https://evil.example/repo', runNumber: '42', apkSizeBytes: 123 }), /GITHUB_REPOSITORY/);

console.log('web wrapper and auto-update smoke tests passed');
