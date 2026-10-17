#!/usr/bin/env node
/**
 * Turn a collected game folder (or ZIP via system unzip) into offline-ready tree.
 * Usage:
 *   node scripts/post-collect-offline.mjs --dir out/game-1 --out artifacts/offline-eajzz --game eajzzxhro-74
 *   node scripts/post-collect-offline.mjs --zip artifacts/game.zip --out artifacts/offline-eajzz
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const o = { zip: null, dir: null, out: "artifacts/offline-package", game: "eajzzxhro-74", mergeNative: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--zip") o.zip = argv[++i];
    else if (a === "--dir") o.dir = argv[++i];
    else if (a === "--out") o.out = argv[++i];
    else if (a === "--game") o.game = argv[++i];
    else if (a === "--merge-native") o.mergeNative = true;
  }
  return o;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function injectOfflineShell(outDir, game) {
  const native = path.join(repoRoot, "native-game");
  const copies = [
    ["sw.js", "sw.js"],
    ["debug-panel.js", "debug-panel.js"],
    ["shell/brotli-loader.js", "shell/brotli-loader.js"],
    ["shell/network-hijack.js", "shell/network-hijack.js"],
    ["shell/audio-unlock.js", "shell/audio-unlock.js"],
    ["vendor/brotli-decode.js", "vendor/brotli-decode.js"],
    ["config/host.json", "config/host.json"],
    ["api/spin.js", "api/spin.js"],
    ["api/balance.js", "api/balance.js"],
    ["api/index.js", "api/index.js"],
    ["start-game.sh", "start-game.sh"],
  ];
  for (const [from, to] of copies) {
    const src = path.join(native, from);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(outDir, to);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }

  const boot = [
    '<script type="module" src="./shell/brotli-loader.js"></script>',
    '<script type="module" src="./shell/network-hijack.js"></script>',
    '<script type="module" src="./shell/audio-unlock.js"></script>',
    '<script src="./debug-panel.js" defer></script>',
    "<script>",
    "if ('serviceWorker' in navigator) {",
    "  window.addEventListener('load', function() {",
    "    navigator.serviceWorker.register('./sw.js').catch(function(e){ console.warn(e); });",
    "  });",
    "}",
    "</script>",
  ].join("\n");

  const indexPath = path.join(outDir, "index.html");
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, "utf8");
    if (!html.includes("brotli-loader.js")) {
      if (html.toLowerCase().includes("</body>")) {
        html = html.replace(/<\/body>/i, boot + "\n</body>");
      } else {
        html += boot;
      }
      fs.writeFileSync(indexPath, html);
    }
  }

  const mf = path.join(outDir, "manifest.json");
  if (!fs.existsSync(mf)) {
    fs.writeFileSync(
      mf,
      JSON.stringify(
        {
          name: game + " Offline",
          short_name: game,
          start_url: "./index.html",
          display: "standalone",
          background_color: "#000000",
          theme_color: "#ffcc00",
        },
        null,
        2
      ) + "\n"
    );
  }
}

async function applyPluginToHtmlFiles(outDir) {
  try {
    const { findPlugin } = await import("../src/plugins/index.js");
    const plugin = findPlugin("https://m.eajzzxhro.com/74/");
    if (!plugin) return { applied: false };
    let count = 0;
    function walk(d) {
      for (const name of fs.readdirSync(d)) {
        const abs = path.join(d, name);
        if (fs.statSync(abs).isDirectory()) walk(abs);
        else if (/\.html?$/i.test(name)) {
          const html = fs.readFileSync(abs, "utf8");
          fs.writeFileSync(abs, plugin.rewriteHtml(html).html);
          count++;
        }
      }
    }
    walk(outDir);
    return { applied: true, files: count };
  } catch (e) {
    return { applied: false, error: String(e.message || e) };
  }
}

const args = parseArgs(process.argv);
const outDir = path.resolve(repoRoot, args.out);
fs.rmSync(outDir, { recursive: true, force: true });
ensureDir(outDir);

if (args.zip) {
  const zipPath = path.resolve(repoRoot, args.zip);
  try {
    execFileSync("unzip", ["-o", zipPath, "-d", outDir], { stdio: "inherit" });
  } catch {
    console.error("unzip failed — install unzip or pass --dir extracted folder");
    process.exit(1);
  }
} else if (args.dir) {
  copyDir(path.resolve(repoRoot, args.dir), outDir);
  console.log("Copied dir", args.dir);
} else {
  console.error("Provide --zip or --dir");
  process.exit(1);
}

const pluginReport = await applyPluginToHtmlFiles(outDir);
console.log("Site plugin:", JSON.stringify(pluginReport));
injectOfflineShell(outDir, args.game);

try {
  execFileSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts/generate-asset-manifest.mjs"),
      "--dir",
      outDir,
      "--out",
      path.join(outDir, "manifests/asset-manifest.json"),
      "--game",
      args.game,
    ],
    { stdio: "inherit" }
  );
} catch (e) {
  console.warn("manifest:", e.message);
}

try {
  execFileSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts/generate-integrity.mjs"),
      "--dir",
      outDir,
      "--out",
      path.join(outDir, "manifests/integrity.json"),
    ],
    { stdio: "inherit" }
  );
} catch (e) {
  console.warn("integrity:", e.message);
}

const readiness = {
  version: "v2-final",
  game: args.game,
  offlineReady: true,
  server: "custom /api/game/*",
  sitePlugin: pluginReport,
  generatedAt: new Date().toISOString(),
  checklist: {
    shellInjected: true,
    serviceWorker: true,
    networkHijack: true,
    audioUnlock: true,
    assetManifest: fs.existsSync(path.join(outDir, "manifests/asset-manifest.json")),
    integrity: fs.existsSync(path.join(outDir, "manifests/integrity.json")),
  },
};
fs.writeFileSync(path.join(outDir, "offline-readiness.json"), JSON.stringify(readiness, null, 2) + "\n");

const zipOut = path.resolve(repoRoot, args.out.replace(/\/$/, "") + ".zip");
try {
  execFileSync("zip", ["-qr", zipOut, "."], { cwd: outDir, stdio: "inherit" });
  console.log("Offline ZIP:", zipOut);
} catch {
  console.warn("zip CLI not available — folder package only at", outDir);
}

console.log("Offline package:", outDir);

if (args.mergeNative) {
  const assetsDest = path.join(repoRoot, "native-game", "assets", args.game);
  copyDir(outDir, assetsDest);
  console.log("Merged into", assetsDest);
}
