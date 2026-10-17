#!/usr/bin/env node
/**
 * Generate native-game/manifests/asset-manifest.json from a directory of assets.
 *
 * Usage:
 *   node scripts/generate-asset-manifest.mjs --dir native-game --out native-game/manifests/asset-manifest.json
 *   node scripts/generate-asset-manifest.mjs --dir out/game-1 --game eajzzxhro-74
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { dir: "native-game", out: null, game: "frostbyte-collector", hash: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") out.dir = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--game") out.game = argv[++i];
    else if (a === "--hash") out.hash = true;
  }
  if (!out.out) out.out = path.join(out.dir, "manifests", "asset-manifest.json");
  return out;
}

function walk(dir, base = dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, base, files);
    else files.push(path.relative(base, abs).replace(/\\/g, "/"));
  }
  return files;
}

function classify(rel) {
  if (/\.html?$/i.test(rel)) return "entrypoint";
  if (/sw\.js$/i.test(rel)) return "service-worker";
  if (/manifest\.json$/i.test(rel)) return "manifest";
  if (/\/api\//i.test(rel) || /api\/.+\.js$/i.test(rel)) return "native-api";
  if (/config\//i.test(rel)) return "config";
  if (/\.(js|mjs|cjs)$/i.test(rel)) return "script";
  if (/\.(css)$/i.test(rel)) return "style";
  if (/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(rel)) return "image";
  if (/\.(mp3|ogg|wav|m4a)$/i.test(rel)) return "audio";
  if (/\.(wasm)(\.br|\.gz)?$/i.test(rel)) return "wasm";
  if (/\.(json)$/i.test(rel)) return "data";
  return "asset";
}

const args = parseArgs(process.argv);
const dir = path.resolve(root, args.dir);
const files = walk(dir).filter((f) => !f.endsWith("validation-report.json"));

const assets = files.map((rel) => {
  const item = {
    path: rel.startsWith("./") ? rel : rel,
    type: classify(rel),
    critical: /^(index\.html|sw\.js|manifest\.json|shell\/|api\/)/i.test(rel),
    permission_status: "AUTHORIZED_OWNER",
  };
  if (args.hash) {
    const buf = fs.readFileSync(path.join(dir, rel));
    item.sha256 = createHash("sha256").update(buf).digest("hex");
  }
  return item;
});

const manifest = {
  schema_version: "1.0",
  package: `${args.game}@1.0.0`,
  game: args.game,
  version: "v2-final",
  totalFiles: assets.length,
  offlineReady: true,
  server: "custom /api/game/*",
  generatedAt: new Date().toISOString(),
  assets,
  files: assets.map((a) => `./${a.path.replace(/^\.\//, "")}`),
  excluded_classes: ["DRM", "TOKEN", "COOKIE", "CREDENTIAL", "PRIVATE_KEY", "PROTECTED_BINARY", "EXTERNAL_BACKEND"],
};

const outPath = path.resolve(root, args.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote ${outPath} (${assets.length} files, offlineReady=true)`);
