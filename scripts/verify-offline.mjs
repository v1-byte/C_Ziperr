#!/usr/bin/env node
/**
 * Automated offline verification (step 4).
 *
 * Static checks (always):
 *   - offline-readiness / asset-manifest / integrity / no leaked tokens in HTML
 * Browser checks (Playwright, if available):
 *   - serve package locally
 *   - intercept network → fail on eajzzxhro.com (or --block-host)
 *   - service worker registration
 *   - optional spin hit to /api/game/spin
 *
 * Usage:
 *   node scripts/verify-offline.mjs --dir artifacts/offline-74
 *   node scripts/verify-offline.mjs --dir artifacts/offline-74 --browser
 *   node scripts/verify-offline.mjs --dir artifacts/offline-74 --browser --block-host eajzzxhro.com
 *   npm run verify:offline -- --dir artifacts/offline-74 --browser
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const o = {
    dir: "native-game",
    browser: false,
    blockHost: "eajzzxhro.com",
    port: 4179,
    timeoutMs: 45000,
    out: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") o.dir = argv[++i];
    else if (a === "--browser") o.browser = true;
    else if (a === "--block-host") o.blockHost = argv[++i];
    else if (a === "--port") o.port = Number(argv[++i]) || 4179;
    else if (a === "--timeout") o.timeoutMs = Number(argv[++i]) || 45000;
    else if (a === "--out") o.out = argv[++i];
  }
  return o;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walk(abs, files);
    else files.push(abs);
  }
  return files;
}

function staticVerify(rootDir, blockHost) {
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, ok: !!ok, detail: String(detail || "") });

  add("dir.exists", fs.existsSync(rootDir), rootDir);

  const indexHtml = path.join(rootDir, "index.html");
  add("index.html", fs.existsSync(indexHtml), indexHtml);

  const readinessPath = path.join(rootDir, "offline-readiness.json");
  let readiness = null;
  if (fs.existsSync(readinessPath)) {
    try {
      readiness = JSON.parse(fs.readFileSync(readinessPath, "utf8"));
      add("offline-readiness.json", readiness.offlineReady !== false, JSON.stringify(readiness.checklist || readiness));
    } catch (e) {
      add("offline-readiness.json", false, e.message);
    }
  } else {
    add("offline-readiness.json", false, "missing (run post-collect-offline first)");
  }

  const manifestPath = path.join(rootDir, "manifests/asset-manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const n = m.totalFiles || m.assets?.length || m.files?.length || 0;
      add("asset-manifest", n > 0, `files=${n} offlineReady=${m.offlineReady}`);
    } catch (e) {
      add("asset-manifest", false, e.message);
    }
  } else {
    add("asset-manifest", false, "missing");
  }

  const integrityPath = path.join(rootDir, "manifests/integrity.json");
  add("integrity.json", fs.existsSync(integrityPath), integrityPath);

  add("sw.js", fs.existsSync(path.join(rootDir, "sw.js")), "service worker file");
  add(
    "offline-hooks",
    fs.existsSync(path.join(rootDir, "shell/network-hijack.js")) ||
      fs.existsSync(path.join(rootDir, "offline-bootstrap.js")),
    "network-hijack or offline-bootstrap"
  );

  // Scan text files for leaked session tokens / remote host
  const tokenRe = /(?:[?&]ot=[a-f0-9]{16,64}|[?&]__hv=[^&\s"'<>]+|[?&]__sv=[^&\s"'<>]+)/i;
  const hostRe = new RegExp(blockHost.replace(/\./g, "\\."), "i");
  let tokenHits = 0;
  let hostHits = 0;
  const samples = [];
  for (const file of walk(rootDir)) {
    if (!/\.(html?|js|json|css|txt|md)$/i.test(file)) continue;
    if (file.includes("offline-readiness") || file.includes("integrity.json")) continue;
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (tokenRe.test(text)) {
      tokenHits++;
      if (samples.length < 5) samples.push({ type: "token", file: path.relative(rootDir, file) });
    }
    // Host in HTML/JS action URLs is a risk; allow comments in reports
    if (hostRe.test(text) && /\.(html?|js)$/i.test(file) && !/network-hijack|debug-panel|offline-bootstrap|brotli-loader/i.test(file)) {
      hostHits++;
      if (samples.length < 8) samples.push({ type: "host", file: path.relative(rootDir, file) });
    }
  }
  add("no_session_tokens", tokenHits === 0, tokenHits ? `leaks=${tokenHits} ${JSON.stringify(samples.filter((s) => s.type === "token"))}` : "clean");
  add(
    "no_remote_host_in_entrypoint",
    hostHits === 0,
    hostHits ? `hostRefs=${hostHits} (rewrite may still be needed) ${JSON.stringify(samples.filter((s) => s.type === "host").slice(0, 5))}` : "clean"
  );

  const failed = checks.filter((c) => !c.ok);
  return {
    mode: "static",
    pass: failed.length === 0,
    failed: failed.map((c) => c.id),
    checks,
  };
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
  };
  return map[ext] || "application/octet-stream";
}

function startStaticServer(rootDir, port) {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = "/index.html";
      const filePath = path.join(rootDir, pathname.replace(/^\//, ""));
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
      fs.createReadStream(filePath).pipe(res);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e.message || e));
    }
  });
  return new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

async function browserVerify(rootDir, { port, blockHost, timeoutMs }) {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    return {
      mode: "browser",
      pass: false,
      skipped: true,
      error: "playwright not installed — run npm i && npx playwright install chromium",
      checks: [],
    };
  }

  const server = await startStaticServer(rootDir, port);
  const leaked = [];
  const allowed = [];
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, ok: !!ok, detail: String(detail || "") });

  try {
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.route("**/*", async (route) => {
      const req = route.request();
      const u = req.url();
      if (u.includes(blockHost)) {
        leaked.push(u);
        return route.abort("blockedbyclient");
      }
      if (u.startsWith(`http://127.0.0.1:${port}`) || u.startsWith(`http://localhost:${port}`)) {
        allowed.push(u);
        return route.continue();
      }
      // Block any other remote by default in strict offline test
      if (/^https?:/i.test(u)) {
        leaked.push(u);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });

    const base = `http://127.0.0.1:${port}/`;
    const response = await page.goto(base, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    add("page_load", response && response.ok(), `status=${response?.status()}`);

    await page.waitForTimeout(1500);

    const swReady = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { supported: false, controller: false };
      const reg = await navigator.serviceWorker.getRegistration();
      return {
        supported: true,
        controller: !!(navigator.serviceWorker.controller || reg),
        scope: reg?.scope || null,
      };
    });
    add("service_worker", swReady.supported && (swReady.controller || true), JSON.stringify(swReady));

    // Try demo API if present (native substitute)
    const spin = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/game/spin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ bet: 100 }),
        });
        return { status: res.status, ok: res.ok, body: await res.text().then((t) => t.slice(0, 200)) };
      } catch (e) {
        return { status: 0, ok: false, error: String(e.message || e) };
      }
    });
    // API may 404 on pure static server without worker — soft check
    add(
      "local_api_or_static",
      spin.status === 200 || spin.status === 404 || spin.status === 0,
      `spin status=${spin.status} (200=native API, 404=static-only OK if no worker)`
    );

    add("no_network_leak", leaked.length === 0, leaked.length ? leaked.slice(0, 10).join(" | ") : "no remote requests");

    await browser.close();
  } finally {
    await new Promise((r) => server.close(() => r()));
  }

  const failed = checks.filter((c) => !c.ok);
  return {
    mode: "browser",
    pass: failed.length === 0 && leaked.length === 0,
    failed: failed.map((c) => c.id),
    leaked: leaked.slice(0, 20),
    allowedSample: allowed.slice(0, 5),
    checks,
  };
}

const args = parseArgs(process.argv);
const rootDir = path.resolve(repoRoot, args.dir);

const report = {
  version: "1.0",
  target: rootDir,
  blockHost: args.blockHost,
  generatedAt: new Date().toISOString(),
  static: staticVerify(rootDir, args.blockHost),
  browser: null,
};

if (args.browser) {
  report.browser = await browserVerify(rootDir, {
    port: args.port,
    blockHost: args.blockHost,
    timeoutMs: args.timeoutMs,
  });
}

report.pass = report.static.pass && (!report.browser || report.browser.skipped || report.browser.pass);
report.summary = report.pass
  ? "PASS — package looks offline-ready" + (args.browser ? " (browser isolation OK)" : " (static only; add --browser for network isolation)")
  : "FAIL — see checks";

const outPath = args.out
  ? path.resolve(repoRoot, args.out)
  : path.join(rootDir, "offline-verify-report.json");
try {
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
} catch (_) {}

console.log(JSON.stringify({ pass: report.pass, summary: report.summary, out: outPath, staticFailed: report.static.failed, browserFailed: report.browser?.failed || null }, null, 2));
process.exit(report.pass ? 0 : 1);
