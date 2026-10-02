import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAtlas, atlasImageCandidates } from "../src/collect/sprite-atlas.js";

const texturePacker = parseAtlas(JSON.stringify({
  frames: {
    "hero.png": { frame: { x: 0, y: 0, w: 32, h: 48 } },
    "coin.png": { frame: { x: 32, y: 0, w: 16, h: 16 }, rotated: true }
  },
  meta: { image: "symbols.png" }
}), "symbols.json");
assert.equal(texturePacker.format, "texture-packer-json");
assert.equal(texturePacker.regions.length, 2);
assert.equal(texturePacker.regions[1].rotated, true);

const libgdx = parseAtlas(`symbols.png\nsize: 128, 128\nformat: RGBA8888\nfilter: Nearest,Nearest\nrepeat: none\n\nhero\n  rotate: false\n  xy: 0, 0\n  size: 32, 48\n` , "symbols.atlas");
assert.equal(libgdx.regions.length, 1);
assert.deepEqual(libgdx.regions[0], { name: "hero", x: 0, y: 0, w: 32, h: 48, rotated: false, source: "libgdx-atlas" });

const candidates = atlasImageCandidates("assets/data/0001-symbols.json", texturePacker, [
  { type: "image", localPath: "assets/images/0002-symbols.png", contentType: "image/png" },
  { type: "image", localPath: "assets/images/0003-other.png", contentType: "image/png" }
]);
assert.equal(candidates.length, 1);

const collector = await readFile(new URL("../scripts/collect.js", import.meta.url), "utf8");
assert.match(collector, /captureMissingStaticAssets\(page, resources, zipFiles, seen, failedRequests, mainDocUrl\)/);
assert.match(collector, /atlas-region-extractor/);
assert.match(collector, /Referer: mainDocUrl/);
console.log("sprite atlas and CDN fallback regression test passed");
