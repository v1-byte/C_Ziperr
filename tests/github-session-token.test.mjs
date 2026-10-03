import test from "node:test";
import assert from "node:assert/strict";
import { ghFetch } from "../src/collect/github.js";

test("GitHub API fails clearly without a configured or session token and makes no request", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("fetch must not run without a token"); };
  try {
    const result = await ghFetch({}, "/repos/v1-byte/C_Ziperr/actions/runs");
    assert.equal(result.status, 401);
    assert.equal(result.data.code, "GITHUB_TOKEN_REQUIRED");
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GitHub API uses the one-session token only as an authorization header", async () => {
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url, headers: new Headers(init.headers) };
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await ghFetch({}, "/repos/v1-byte/C_Ziperr/actions/runs", {}, "session-token-test");
    assert.equal(result.ok, true);
    assert.equal(captured.url, "https://api.github.com/repos/v1-byte/C_Ziperr/actions/runs");
    assert.equal(captured.headers.get("Authorization"), "Bearer session-token-test");
    assert.equal(JSON.stringify(result).includes("session-token-test"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("configured Worker token remains the fallback when no session token is supplied", async () => {
  const originalFetch = globalThis.fetch;
  let authorization = "";
  globalThis.fetch = async (_url, init) => {
    authorization = new Headers(init.headers).get("Authorization");
    return new Response("{}", { status: 200 });
  };
  try {
    const result = await ghFetch({ GITHUB_TOKEN: "worker-secret-test" }, "/repos/v1-byte/C_Ziperr/actions/runs");
    assert.equal(result.ok, true);
    assert.equal(authorization, "Bearer worker-secret-test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid GitHub credentials return a non-secret error code", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 });
  try {
    const result = await ghFetch({}, "/repos/v1-byte/C_Ziperr/actions/runs", {}, "invalid-token-test");
    assert.equal(result.status, 401);
    assert.equal(result.data.code, "GITHUB_TOKEN_INVALID");
    assert.equal(JSON.stringify(result).includes("invalid-token-test"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing Actions permission is distinguished from a GitHub API rate limit", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "Resource not accessible by personal access token" }), { status: 403 });
    const scope = await ghFetch({}, "/repos/v1-byte/C_Ziperr/actions/runs", {}, "scope-token-test");
    assert.equal(scope.data.code, "GITHUB_TOKEN_SCOPE");

    globalThis.fetch = async () => new Response(JSON.stringify({ message: "API rate limit exceeded" }), { status: 403 });
    const rateLimit = await ghFetch({}, "/repos/v1-byte/C_Ziperr/actions/runs", {}, "rate-token-test");
    assert.equal(rateLimit.data.message, "API rate limit exceeded");
    assert.equal(rateLimit.data.code, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
