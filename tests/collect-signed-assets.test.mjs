import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../scripts/collect.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

assert.match(source, /captureMissingStaticAssets/);
assert.match(source, /extractProactiveCandidates\(sources, runtimeUrls, 500\)/);
assert.match(source, /maxFileBytes = 20 \* 1024 \* 1024/);
assert.match(source, /maxTotalBytes = 200 \* 1024 \* 1024/);
assert.match(source, /html-response-not-static-asset/);
assert.match(source, /skippedLarge/);
assert.match(source, /page\.request\.get\(url/);
assert.match(source, /Referer: mainDocUrl/);
assert.match(source, /capturedBy: 'proactive-static-asset'/);
assert.match(source, /PROGRESS: proactive_static_assets/);
assert.match(source, /smartPackage\(zipFiles, resources\)/);
assert.match(source, /if \(u\.search\) u\.search = '\?<redacted>'/);
assert.match(worker, /if \(u\.search\) u\.search = '\?<redacted>'/);
assert.match(worker, /recordSizeLimit\(u, type, req\.method\(\), response\.status\(\), ct, "declared-size-limit:/);
assert.match(worker, /"raw-total-limit"/);

console.log("signed asset proactive capture test passed");
