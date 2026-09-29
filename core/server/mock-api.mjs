import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function loadMockRules(root) {
  const rules = [], serverDir = join(root, 'server');
  for (const name of await readdir(serverDir).catch(() => [])) if (/\.json$/i.test(name)) { try { const a = JSON.parse(await readFile(join(serverDir, name), 'utf8')); if (a.url) rules.push({ match: new URL(a.url).pathname, method: a.method || 'GET', status: a.status || 200, body: a.response ?? a.response_b64 ?? '' }); } catch {} }
  try { const extra = JSON.parse(await readFile(join(root, 'mock-api.json'), 'utf8')); if (Array.isArray(extra)) for (const rule of extra) rules.push(rule); } catch {}
  return rules;
}
export function createMockApiServer({ rules = [], host = '127.0.0.1', port = 0, defaultStatus = 404 } = {}) {
  const log = [], state = new Map();
  const server = createServer(async (req, res) => {
    if (req.url === '/__health') return respond(res, 200, { ok: true, rules: rules.length });
    const url = new URL(req.url || '/', `http://${host}`), chunks = []; for await (const chunk of req) chunks.push(chunk); const requestBody = Buffer.concat(chunks).toString();
    const candidates = rules.filter(r => String(r.method || 'GET').toUpperCase() === req.method && (r.match === url.pathname || new RegExp(String(r.match).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(url.pathname)) && (!r.when || requestBody.includes(r.when)));
    const rule = candidates[0]; const entry = { method: req.method, path: url.pathname, requestBody, matched: !!rule, at: new Date().toISOString() }; log.push(entry);
    if (!rule) return respond(res, defaultStatus, { error: 'mock route not found', path: url.pathname });
    if (rule.delay_ms) await new Promise(r => setTimeout(r, Math.min(30000, Number(rule.delay_ms) || 0)));
    let body = rule.body ?? rule.response ?? '';
    if (typeof body === 'object') body = JSON.stringify(body);
    if (rule.state_key) state.set(rule.state_key, rule.state_value);
    respond(res, Number(rule.status) || 200, body, rule.headers || {});
  });
  return { server, log, state, async start() { await new Promise(r => server.listen(port, host, r)); const a = server.address(); return { host: a.address, port: a.port, url: `http://${a.address}:${a.port}` }; }, async stop() { await new Promise((r, j) => server.close(e => e ? j(e) : r())); } };
}
function respond(res, status, body, extra = {}) { const text = typeof body === 'string' ? body : JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }); res.end(text); }
