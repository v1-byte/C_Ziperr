import assert from "node:assert/strict";
import { resolveLimits } from "../src/collect/limits.js";
import { fillMissingAssetsV2 } from "../src/collect/fill-missing-enhanced.js";

const standard = resolveLimits({}, {});
const unlimitedWorker = resolveLimits({}, { unlimited: true });
const unlimitedR2 = resolveLimits({ COLLECTOR_BUCKET: {} }, { mode: "unlimited" });

assert.equal(standard.fillPerPass, 250);
assert.equal(standard.fillPasses, 8);
assert.equal(unlimitedWorker.fillPerPass, 300);
assert.equal(unlimitedWorker.fillPasses, 8);
assert.equal(unlimitedWorker.maxRawTotal, 72 * 1024 * 1024);
assert.equal(unlimitedR2.fillPerPass, 400);
assert.equal(unlimitedR2.fillPasses, 10);
assert.equal(unlimitedR2.maxRawTotal, 120 * 1024 * 1024);

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

console.log("capture scale limits test passed");
