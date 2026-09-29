import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { join, relative, extname, resolve } from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const headers = { 'content-security-policy': "default-src 'self' data: blob:; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };

export function createPreviewServer({ root, host = '127.0.0.1', port = 0, apiHandler = null } = {}) {
  if (!root) throw new Error('Preview root wajib diisi');
  const rootPath = resolve(root); let rootReal;
  const server = createServer(async (req, res) => {
    try {
      if (req.url === '/__health') return sendJson(res, 200, { ok: true, root: rootPath });
      if (apiHandler && new URL(req.url, `http://${host}`).pathname.startsWith('/api/')) return apiHandler(req, res);
      const rawPath = String(req.url || '').split('?')[0];
      let decoded; try { decoded = decodeURIComponent(rawPath); } catch { return end(res, 400, 'Bad URL'); }
      if (/(^|\/)\.\.(\/|$)/.test(decoded) || decoded.includes('\\')) return end(res, 403, 'Path traversal blocked');
      const rel = decoded.replace(/^\/+/, '') || 'index.html';
      const target = resolve(rootPath, rel);
      if (relative(rootPath, target).startsWith('..') || relative(rootPath, target).includes(`..${process.platform === 'win32' ? '\\' : '/'}`)) return end(res, 403, 'Path traversal blocked');
      const st = await stat(target).catch(() => null); if (!st || !st.isFile()) return end(res, 404, 'Not found');
      if (!rootReal) rootReal = await realpath(rootPath);
      const targetReal = await realpath(target); if (relative(rootReal, targetReal).startsWith('..')) return end(res, 403, 'Symlink escape blocked');
      res.writeHead(200, { ...headers, 'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream', 'content-length': st.size }); createReadStream(target).pipe(res);
    } catch (error) { end(res, 500, String(error.message || error)); }
  });
  return { server, async start() { await new Promise(resolveStart => server.listen(port, host, resolveStart)); const a = server.address(); return { host: a.address, port: a.port, url: `http://${a.address}:${a.port}` }; }, async stop() { await new Promise((resolveStop, reject) => server.close(error => error ? reject(error) : resolveStop())); } };
}
function end(res, status, body) { res.writeHead(status, { ...headers, 'content-type': 'text/plain; charset=utf-8' }); res.end(body); }
function sendJson(res, status, body) { res.writeHead(status, { ...headers, 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
