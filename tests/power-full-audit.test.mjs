import assert from "node:assert/strict";
import test from "node:test";
import { buildPowerFullAudit } from "../src/audit/power-full.js";

const completeEvidence = {
  manifest: ["index.html", "game.js", "manifest.json", "assets/reel.png"],
  apiKinds: ["session", "init", "balance", "spin", "result"],
  apiContract: [{ kind: "session" }, { kind: "init" }, { kind: "balance" }, { kind: "spin" }, { kind: "result" }],
  networkRequests: [{ url: "/game.js", local: true, networkOffBlocked: true }],
  browserTest: { networkIsolated: true, gameplayReady: true, status: "PASS" },
  securityEvidence: { signals: [], blocked: false }
};

test("Power Full Audit returns FULL_OFFLINE_READY only with complete evidence", () => {
  const report = buildPowerFullAudit(completeEvidence);
  assert.equal(report.status, "FULL_OFFLINE_READY");
  assert.equal(report.decision, "PASS");
  assert.equal(report.score, 100);
  assert.equal(report.blockers.length, 0);
  assert.equal(report.policy.bypassControls, false);
});

test("Power Full Audit blocks missing API and network-off proof", () => {
  const report = buildPowerFullAudit({ manifest: ["index.html", "game.js"] });
  assert.equal(report.status, "NOT_READY");
  assert.equal(report.decision, "BLOCK");
  assert.ok(report.blockers.some((item) => item.code === "API_RESULT_MISSING"));
  assert.ok(report.blockers.some((item) => item.code === "BROWSER_NETWORK_OFF_NOT_PROVEN"));
});

test("Power Full Audit blocks protected signals without requesting an authorization attestation", () => {
  const report = buildPowerFullAudit({
    ...completeEvidence,
    securityEvidence: { blocked: true, signals: [{ type: "DRM" }] }
  });
  assert.equal(report.status, "NOT_READY");
  assert.ok(report.blockers.some((item) => item.code === "PROTECTED_RESOURCE_BLOCKED"));
  assert.equal(report.policy.protectedResourceBlocksRelease, true);
  assert.equal(report.policy.authorizedResearchRequired, undefined);
});
