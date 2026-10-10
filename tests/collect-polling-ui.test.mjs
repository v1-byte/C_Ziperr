import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/collect.yml", import.meta.url), "utf8");
const collector = await readFile(new URL("../scripts/collect.js", import.meta.url), "utf8");

test("large GitHub collect continues polling beyond the workflow runtime", () => {
  assert.match(html, /const pollIntervalMs = 10_000/);
  assert.match(html, /const maxWaitMs = 65 \* 60 \* 1000/);
  assert.match(html, /\}, pollIntervalMs\);/);
  assert.doesNotMatch(html, /const maxTries = 60; \/\/~5 menit/);
  assert.match(workflow, /timeout-minutes: 60/);
});

test("collect UI exposes the exact run log and reports the failed workflow step", () => {
  assert.match(html, /function gcSetCollectRunLink\(value\)/);
  assert.match(html, /url\.hostname !== 'github\.com'/);
  assert.match(html, /Buka log GitHub Actions/);
  assert.match(html, /const failedStep = failedJob/);
  assert.match(html, /data\.conclusion === 'success'/);
  assert.match(html, /data\.html_url/);
});

test("dispatch/run lookup communicates indexing delay without encouraging duplicate collects", () => {
  assert.match(worker, /run_lookup_pending: !run/);
  assert.match(html, /Jangan kirim ulang dulu/);
  assert.match(workflow, /run-name: C\.Ziperr Collect \$\{\{ inputs\.request_id \}\}/);
  assert.match(workflow, /request_id:/);
});

test("completed ZIP assets are rendered in the persistent capture panel", () => {
  assert.match(html, /async function gcReadPackageAssetRows\(zip, fallbackNames\)/);
  assert.match(html, /async function gcPublishZipAssets\(zip, statusLabel\)/);
  assert.match(html, /gcRenderLiveFiles\(rows\.slice\(\)\.reverse\(\), rows\.length, 100\)/);
  assert.match(html, /const slice = files\.slice\(0, 100\)/);
});

test("Android save acknowledgement precedes Workspace import and triggers guarded offline repair", () => {
  const loader = html.slice(html.indexOf("async function gcLoadCaptureBlobToWorkspace"), html.indexOf("function gcSetCapturePreviewStatus"));
  assert.ok(loader.indexOf("await gcEnsureNativeSaved(blob, safeFilename)") < loader.indexOf("input.dispatchEvent"));
  assert.match(html, /gcAutoRepairWorkspaceAfterImport\(previousZip, safeFilename\)/);
  assert.match(html, /-offline-prepared\.zip/);
  assert.match(html, /do not modify login|jangan menyentuh login|CAPTCHA, DRM, pembayaran, atau keamanan/i);
  assert.match(html, /await gcEnsureNativeSaved\(blob, packageStorageName\)/);
  assert.match(html, /var partialWorkspaceLoaded = await gcLoadCaptureBlobToWorkspace/);
  assert.match(html, /var storageLabel = window\.ReactNativeWebView \? 'disimpan internal' : 'diunduh'/);
});

test("GitHub collector no longer silently drops individual files above 18 MiB", () => {
  assert.doesNotMatch(collector, /buffer\.length\s*>\s*18\s*\*\s*1024\s*\*\s*1024/);
  assert.match(collector, /if \(status >= 400\)/);
  assert.match(collector, /captcha_or_challenge/);
  assert.match(collector, /drm_or_license/);
});
