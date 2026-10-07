import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/collect.yml", import.meta.url), "utf8");

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
