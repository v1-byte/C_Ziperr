import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

test("GitHub collect dispatch accepts the session token header and forwards it to GitHub API", () => {
  assert.match(source, /url\.pathname === "\/api\/github\/collect"[\s\S]{0,1200}const sessionToken = String\(request\.headers\.get\("X-GC-GitHub-Token"\)/);
  assert.match(source, /actions\/workflows\/\$\{ghConfig\(env\)\.workflow\}\/dispatches[\s\S]{0,1200}\}, sessionToken\);/);
  assert.match(source, /GITHUB_TOKEN_REQUIRED/);
  assert.doesNotMatch(source, /console\.log\([^\n]*sessionToken/);
});

test("GitHub status and artifact endpoints use a token without persisting it", () => {
  assert.match(source, /url\.pathname === "\/api\/github\/status"[\s\S]{0,500}const sessionToken = String\(request\.headers\.get\("X-GC-GitHub-Token"\)/);
  assert.match(source, /actions\/runs\/\$\{runId\}[\s\S]{0,400}\}, sessionToken\)/);
  assert.match(source, /url\.pathname === "\/api\/github\/artifact"[\s\S]{0,500}const sessionToken = String\(request\.headers\.get\("X-GC-GitHub-Token"\)/);
  assert.match(source, /const token = sessionToken \|\| env\.GITHUB_TOKEN/);
});
