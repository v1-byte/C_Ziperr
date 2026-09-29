import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
const TEXT = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.json', '.txt', '.xml', '.yml', '.yaml']);
export async function rewritePackage(root, { from, to, dryRun = false } = {}) {
  if (!from || !to) throw new Error('from dan to wajib diisi'); const files = await walk(root), changed = [], unresolved = [];
  for (const file of files) { if (!TEXT.has(extname(file).toLowerCase())) continue; let source = await readFile(file, 'utf8'), next = source.split(from).join(to); if (next !== source) { changed.push({ file, replacements: count(source, from) }); if (!dryRun) await writeFile(file, next); } for (const u of source.matchAll(/(?:https?:)?\/\/[^\s"'<>`]+/g)) if (u[0].includes(from)) unresolved.push({ file, url: u[0] }); }
  const report = { from, to, dryRun, changed, unresolved, filesScanned: files.length, generatedAt: new Date().toISOString() }; if (!dryRun) await writeFile(join(root, 'rewrite-report.json'), JSON.stringify(report, null, 2)); return report;
}
async function walk(root) { const out = []; for (const name of await readdir(root)) { const p = join(root, name), s = await stat(p); if (s.isDirectory() && !name.startsWith('.')) out.push(...await walk(p)); else if (s.isFile()) out.push(p); } return out; }
function count(s, q) { return q ? s.split(q).length - 1 : 0; }
