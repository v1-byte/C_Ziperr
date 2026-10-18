import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/collect.yml", import.meta.url), "utf8");
const collector = await readFile(new URL("../scripts/collect.js", import.meta.url), "utf8");

test("large GitHub collect keeps polling through the six-hour Actions window", () => {
  assert.match(html, /function startGithubPoll\(runId\)/);
  assert.match(html, /pollTimer = setInterval\(async function \(\)/);
  assert.match(html, /\}, 2500\);/);
  assert.doesNotMatch(html, /maxWaitMs|const maxTries = 60/);
  assert.match(workflow, /timeout-minutes: 360/);
  assert.match(collector, /largeCapture \? 5 \* 60 \* 60 \* 1000/);
});

test("collect UI reports the GitHub run URL, artifact, and failure conclusion", () => {
  assert.match(html, /function startGithubPoll\(runId\)/);
  assert.match(html, /data\.artifact && data\.artifact\.id/);
  assert.match(html, /data\.conclusion === "success"/);
  assert.match(html, /GitHub Actions gagal:/);
  assert.match(html, /data\.html_url/);
});

test("dispatch/run lookup communicates indexing delay without encouraging duplicate collects", () => {
  assert.match(worker, /run_lookup_pending: !run/);
  assert.match(html, /Jangan kirim ulang dulu/);
  assert.match(workflow, /run-name: C\.Ziperr Collect \$\{\{ inputs\.request_id \}\}/);
  assert.match(workflow, /request_id:/);
});
