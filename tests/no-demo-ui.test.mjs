import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const collector = await readFile(new URL("../scripts/collect.js", import.meta.url), "utf8");

test("collect and analysis screens do not generate demo ZIPs or synthetic progress entries", () => {
  assert.doesNotMatch(html, /Jalankan ZIP contoh|game-contoh\.zip|contoh-game\.com|Coba: "cari spin"|resource-\d+|function stub\(|demo-001|respons contoh/i);
  assert.match(html, /Analisis ZIP Workspace/);
  assert.match(html, /const apis = \[\]/);
  assert.match(html, /Hasil collect asli/);
  assert.match(html, /mock_offline: false/);
});

test("mock/replay metadata is opt-in only", () => {
  assert.match(worker, /const mockOffline = body\.mock_offline === true/);
  assert.match(collector, /const MOCK_OFFLINE = process\.env\.MOCK_OFFLINE === "1"/);
});

test("workspace does not expose simulated terminal, canned AI chat, or old reel demo UI", () => {
  assert.doesNotMatch(html, /C\.Ziperr terminal \(proses lokal\)|id="termForm"|term\.new|term\.clear|data-p="term"|Asisten AI|function aiReply|id="v-ai"|\.stage \.reel/);
  assert.match(html, /id="v-explorer"/);
  assert.match(html, /data-p="prob"/);
  assert.match(html, /data-p="out"/);
  assert.match(html, /Custom API/);
});

test("system log starts empty instead of showing fabricated startup activity", () => {
  assert.doesNotMatch(html, /C\.Ziperr UI siap|Siap collect — Worker \/ GitHub runner dari tab Collect|Editor, lint, dan workspace siap/);
});
