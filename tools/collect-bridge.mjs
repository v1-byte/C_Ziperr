#!/usr/bin/env node
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 8788), root = resolve(process.env.CZIPERR_BRIDGE_OUT || '.c-ziperr/bridge'); await mkdir(root, { recursive: true }); const jobs = new Map();
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const json = (res, status, body) => { res.writeHead(status, { ...CORS, 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
async function body(req) { const a = []; for await (const c of req) a.push(c); return JSON.parse(Buffer.concat(a).toString() || '{}'); }
const server = createServer(async (req, res) => { if (req.method === 'OPTIONS') return res.writeHead(204, CORS).end(); const u = new URL(req.url || '/', `http://${host}:${port}`); try {
  if (u.pathname === '/api/collect' && req.method === 'POST') { const b = await body(req); if (!/^https?:\/\//.test(b.url || '')) return json(res, 400, { error: 'URL tidak valid' }); const tag = randomUUID().slice(0, 8), out = join(root, tag), zip = join(root, `${tag}.zip`); const child = spawn(process.execPath, ['tools/collect-local.mjs', b.url, '--out', out, '--play-seconds', String(b.play_seconds || 90), '--spins', String(b.spins || 30), '--zip', zip], { cwd: resolve('.'), env: { ...process.env, CZIPERR_JOBS_DB: join(root, 'jobs.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] }); const job = { tag, status: 'queued', conclusion: null, out, zip, logs: [] }; jobs.set(tag, job); child.stdout.on('data', d => job.logs.push(String(d))); child.stderr.on('data', d => job.logs.push(String(d))); child.on('error', e => { job.status = 'completed'; job.conclusion = 'failure'; job.error = String(e.message || e); }); child.on('exit', code => { job.status = 'completed'; job.conclusion = code === 0 ? 'success' : 'failure'; }); return json(res, 200, { tag }); }
  if (u.pathname === '/api/status') { const job = jobs.get(u.searchParams.get('tag')); return json(res, job ? { found: true, status: job.status, conclusion: job.conclusion, logs: job.logs.slice(-10) } : { found: false }); }
  if (u.pathname === '/api/download') { const job = jobs.get(u.searchParams.get('tag')); if (!job || job.status !== 'completed' || job.conclusion !== 'success') return json(res, 409, { error: 'Local job belum sukses' }); const s = await stat(job.zip).catch(() => null); if (!s) return json(res, 404, { error: 'ZIP tidak ditemukan' }); res.writeHead(200, { ...CORS, 'content-type': 'application/zip', 'content-length': s.size }); return createReadStream(job.zip).pipe(res); }
  if (u.pathname === '/api/health') return json(res, 200, { ok: true, jobs: jobs.size }); return json(res, 404, { error: 'Tidak ditemukan' });
} catch (e) { json(res, 500, { error: String(e.message || e) }); } });
server.listen(port, host, () => console.log(JSON.stringify({ ok: true, url: `http://${host}:${port}/api`, health: `http://${host}:${port}/api/health` })));
