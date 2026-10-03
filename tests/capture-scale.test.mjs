import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveLimits } from "../src/collect/limits.js";
import { fillMissingAssetsV2 } from "../src/collect/fill-missing-enhanced.js";
import { fetchWithRetry } from "../src/collect/fetch-retry.js";

const standard = resolveLimits({}, {});
const unlimitedWorker = resolveLimits({}, { unlimited: true });
const unlimitedR2 = resolveLimits({ COLLECTOR_BUCKET: {} }, { mode: "unlimited" });
const workerSource = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

assert.equal(standard.fillPerPass, 250);
assert.equal(standard.fillPasses, 8);
assert.equal(unlimitedWorker.fillPerPass, 300);
assert.equal(unlimitedWorker.fillPasses, 8);
assert.equal(unlimitedWorker.maxRawTotal, 72 * 1024 * 1024);
assert.equal(unlimitedR2.fillPerPass, 400);
assert.equal(unlimitedR2.fillPasses, 10);
assert.equal(unlimitedR2.maxRawTotal, 120 * 1024 * 1024);
assert.match(workerSource, /if \(!hasR2 && rawTotal > limRaw \* 1\.15\)/);
assert.match(workerSource, /if \(zipData\.byteLength > limZip\)/);

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response("{}", {
  status: 200,
  headers: { "content-type": "application/json" }
});

try {
  const report = await fillMissingAssetsV2(
    {}, [], new Set(), "https://owned-game.example/", "scale-test", null, null,
    {
      maxPerPass: 999,
      maxPasses: 99,
      maxRawTotal: 1,
      maxSingleFile: 100,
      seedUrls: ["https://owned-game.example/assets/catalog.json"]
    }
  );

  assert.equal(report.maxPerPass, 400, "the V2 wrapper must honor the shared hard cap");
  assert.equal(report.maxPasses, 12, "the V2 wrapper must honor the shared hard cap");
  assert.equal(report.fetched, 0, "raw-byte limit must stop an oversized package addition");
  assert.equal(report.stillMissing[0]?.error, "raw-total-limit");
} finally {
  globalThis.fetch = originalFetch;
}

let attempts = 0;
const delays = [];
const recovered = await fetchWithRetry("https://owned-game.example/retry", {}, {
  fetchImpl: async () => {
    attempts++;
    if (attempts === 1) return new Response("busy", { status: 503 });
    if (attempts === 2) return new Response("slow down", { status: 429, headers: { "retry-after": "0" } });
    return new Response("ok", { status: 200 });
  },
  sleep: async (ms) => delays.push(ms)
});
assert.equal(recovered.status, 200);
assert.equal(attempts, 3, "transient server/rate failures should be retried with a bounded attempt count");
assert.deepEqual(delays, [250, 0]);

let deniedAttempts = 0;
const denied = await fetchWithRetry("https://owned-game.example/private", {}, {
  fetchImpl: async () => {
    deniedAttempts++;
    return new Response("forbidden", { status: 403 });
  },
  sleep: async () => assert.fail("permanent access denial must not be retried")
});
assert.equal(denied.status, 403);
assert.equal(deniedAttempts, 1);

console.log("capture scale limits test passed");
