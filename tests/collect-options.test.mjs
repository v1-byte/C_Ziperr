import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCollectOptions, parseBooleanOption } from "../src/collect/options.js";

test("collect options fall back from invalid values and stay within safe bounds", () => {
  assert.deepEqual(normalizeCollectOptions({
    WAIT_SECONDS: "not-a-number",
    AUTO_SPINS: "9999",
    AUTO_HISTORY: "false",
    SPIN_DELAY_MS: "-1"
  }), {
    waitSeconds: 22,
    autoSpins: 100,
    autoHistory: false,
    spinDelayMs: 800
  });
});

test("boolean options accept common workflow representations", () => {
  assert.equal(parseBooleanOption("0"), false);
  assert.equal(parseBooleanOption("false"), false);
  assert.equal(parseBooleanOption("off"), false);
  assert.equal(parseBooleanOption("yes"), true);
  assert.equal(parseBooleanOption("unknown", false), false);
});
