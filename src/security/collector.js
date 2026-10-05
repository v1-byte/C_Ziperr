const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const IGNORE = /(?:^|[\\/])(?:node_modules|\.git|build|dist|\.gradle|\.idea|coverage)(?:[\\/]|$)/i;

function hashFile(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}
function walk(dir, root = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (IGNORE.test(full)) continue;
    if (entry.isDirectory()) walk(full, root, out);
    else if (entry.isFile()) {
      const stat = fs.statSync(full);
      if (stat.size <= MAX_FILE_SIZE) out.push({ path: full, relative: path.relative(root, full), size: stat.size, sha256: hashFile(full) });
    }
  }
  return out;
}
function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } }
module.exports = { walk, readText, hashFile, MAX_FILE_SIZE };
