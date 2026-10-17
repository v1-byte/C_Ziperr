#!/usr/bin/env node
/**
 * SHA-256 integrity map for native-game (or any asset root).
 * Usage: node scripts/generate-integrity.mjs --dir native-game --out native-game/manifests/integrity.json
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { dir: "native-game", out: "native-game/manifests/integrity.json" };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--dir") out.dir = argv[++i];
    else if (argv[i] === "--out") out.out = argv[++i];
  }
  return out;
}

function walk(dir, base, files = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walk(abs, base, files);
    else files.push(path.relative(base, abs).replace(/\\/g, "/"));
  }
  return files;
}

const args = parseArgs(process.argv);
const dir = path.resolve(root, args.dir);
const files = walk(dir, dir);
const hashes = {};
for (const rel of files) {
  if (rel.endsWith("integrity.json") || rel.endsWith("validation-report.json")) continue;
  const buf = fs.readFileSync(path.join(dir, rel));
  hashes[`./${rel}`] = `sha256-${createHash("sha256").update(buf).digest("hex")}`;
}

const payload = {
  schema_version: "1.0",
  algorithm: "sha256",
  generatedAt: new Date().toISOString(),
  totalFiles: Object.keys(hashes).length,
  files: hashes,
};

const outPath = path.resolve(root, args.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
console.log(`Wrote ${outPath} (${payload.totalFiles} hashes)`);
