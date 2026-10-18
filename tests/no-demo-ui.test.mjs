import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const collector = await readFile(new URL("../scripts/collect.js", import.meta.url), "utf8");
const androidApp = await readFile(new URL("../android-app/app/index.tsx", import.meta.url), "utf8");

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
  assert.match(html, /<h1 class="ws-heading">/);
  assert.match(html, /class="ws-heading-name">Workspace<\/span>/);
  assert.match(html, /class="ws-heading-tag">EDITOR KODE<\/span>/);
  for (const label of ["Explorer", "Cari", "API", "Setelan"]) {
    assert.match(html, new RegExp(`<span class="act-label" aria-hidden="true">${label}<\\/span>`));
  }
  assert.match(html, /class="side-title"[^>]*>[\s\S]*?Explorer/);
  assert.match(html, /id="exExp"><svg/);
  assert.doesNotMatch(html, /Editor kode di browser dengan Explorer, pencarian, analisis masalah, dan Custom API\. Perubahan disimpan di memori halaman ini\./);
});

test("system log starts empty instead of showing fabricated startup activity", () => {
  assert.doesNotMatch(html, /C\.Ziperr UI siap|Siap collect — Worker \/ GitHub runner dari tab Collect|Editor, lint, dan workspace siap/);
});

test("HD Max Pro is the first-render skin and still uses the real collector", () => {
  assert.match(html, /<html data-skin="hd">/);
  assert.match(html, /id="skinBtn"[^>]*>Mode: HD Max Pro<\/button>/);
  assert.match(html, /async function realCollect\(useGithub\)/);
  assert.match(html, /var endpoint = \(useGithub \|\| modeBig\) \? "\/api\/github\/collect" : "\/api\/collect";/);
  assert.match(html, /origFetch\("\/api\/progress\?id="/);
  assert.doesNotMatch(html, /function buildPool\(/);
});

test("the real asset donut summary remains visible", () => {
  assert.match(html, /\.asx\{display:grid;gap:14px\}/);
  assert.doesNotMatch(html, /#asx\{display:none!important\}/);
  assert.match(html, /id="asx"/);
});

test("a phone-stored collect ZIP can be opened in Workspace and exported again", () => {
  assert.match(html, /id="collectSaveNote"/);
  assert.match(html, /function readWorkspaceZip\(source, filename\)/);
  assert.match(html, /github-artifact/i);
  assert.match(html, /window\.__CZIPERR_IMPORT_SAVED_ZIP = async function/);
  assert.match(html, /type: "open_saved_zip_list"/);
  assert.match(html, /function exportZip\(\) \{ saveBlob\(makeZip\(files\)/);
  assert.match(androidApp, /loadSavedZipToWorkspace/);
  assert.match(androidApp, /open_saved_zip_list/);
  assert.match(androidApp, /load_saved_zip_ack/);
  assert.match(androidApp, /FileSystem\.readAsStringAsync\(file\.uri,[\s\S]*?position,[\s\S]*?length/);
  assert.match(androidApp, />Workspace<\/Text>/);
});
