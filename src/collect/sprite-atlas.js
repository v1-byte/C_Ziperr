const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif)(?:[?#]|$)/i;

function cleanName(value) {
  return String(value || "sprite")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 120) || "sprite";
}

function regionFromFrame(name, frame, source = "texture-packer") {
  if (!frame || typeof frame !== "object") return null;
  const box = frame.frame || frame;
  const x = Number(box.x), y = Number(box.y), w = Number(box.w ?? box.width), h = Number(box.h ?? box.height);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  return { name: cleanName(name), x, y, w, h, rotated: Boolean(frame.rotated), source };
}

export function parseTexturePacker(text) {
  try {
    const data = JSON.parse(String(text));
    const frames = data.frames;
    const entries = Array.isArray(frames)
      ? frames.map((item) => [item.filename || item.name, item])
      : Object.entries(frames || {});
    return {
      format: "texture-packer-json",
      page: data.meta?.image || null,
      regions: entries.map(([name, frame]) => regionFromFrame(name, frame)).filter(Boolean)
    };
  } catch {
    return null;
  }
}

export function parseLibGdxAtlas(text) {
  const lines = String(text).replace(/\r/g, "").split("\n");
  const regions = [];
  let page = null;
  let current = null;
  const number = (value) => Number(String(value || "").trim());
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { current = null; continue; }
    const size = line.match(/^size:\s*(\d+)\s*,\s*(\d+)/i);
    if (size && current) { current.w = Number(size[1]); current.h = Number(size[2]); continue; }
    if (/^(size|format|filter|min|repeat|pma):/i.test(line)) continue;
    const pair = line.match(/^(xy|x|y|orig|offset|index|split|pad):\s*(.*)$/i);
    if (pair && current) {
      const values = pair[2].split(",").map(number);
      if (pair[1].toLowerCase() === "xy") { current.x = values[0]; current.y = values[1]; continue; }
      if (pair[1].toLowerCase() === "x") current.x = values[0];
      if (pair[1].toLowerCase() === "y") current.y = values[0];
      continue;
    }
    const rotate = line.match(/^rotate:\s*(true|false|\d+)/i);
    if (rotate && current) { current.rotated = rotate[1].toLowerCase() === "true" || rotate[1] === "90"; continue; }
    if (/\.(png|jpe?g|webp)$/i.test(line) && !line.includes(":")) { page = line; current = null; continue; }
    if (!line.includes(":") && !/^\d/.test(line)) {
      current = { name: cleanName(line), x: NaN, y: NaN, w: NaN, h: NaN, rotated: false, source: "libgdx-atlas" };
      regions.push(current);
    }
  }
  return { format: "libgdx-atlas", page, regions: regions.filter((r) => [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0) };
}

export function parseAtlas(text, path = "") {
  const value = String(text || "");
  if (/\.json$/i.test(path) || /^\s*[{"[]/.test(value)) {
    const parsed = parseTexturePacker(value);
    if (parsed?.regions?.length) return parsed;
  }
  if (/\.atlas$/i.test(path) || /(?:^|\n)size:\s*\d+\s*,/i.test(value)) {
    const parsed = parseLibGdxAtlas(value);
    if (parsed.regions.length) return parsed;
  }
  return null;
}

export function atlasImageCandidates(atlasPath, atlas, resources) {
  const names = new Set();
  if (atlas?.page) names.add(String(atlas.page).split("/").pop());
  const base = String(atlasPath).split("/").pop().replace(/\.(json|atlas)$/i, "");
  for (const resource of resources || []) {
    if (resource.type !== "image" || !resource.localPath) continue;
    const localBase = resource.localPath.split("/").pop().replace(/^\d{3,5}-/, "");
    if ((atlas?.page && localBase === String(atlas.page).split("/").pop()) || localBase.startsWith(base)) names.add(localBase);
  }
  return (resources || []).filter((resource) => resource.type === "image" && resource.localPath && names.has(resource.localPath.split("/").pop().replace(/^\d{3,5}-/, "")));
}

export function makeRegionPath(atlasImagePath, regionName, used) {
  const base = cleanName(atlasImagePath.split("/").pop().replace(/\.[^.]+$/, ""));
  let path = `assets/images/extracted/${base}/${cleanName(regionName)}.png`;
  let n = 2;
  while (used.has(path)) path = `assets/images/extracted/${base}/${cleanName(regionName)}-${n++}.png`;
  used.add(path);
  return path;
}

export { IMAGE_EXT_RE };
