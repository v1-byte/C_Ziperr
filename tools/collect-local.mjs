#!/usr/bin/env node
import { chromium } from 'playwright';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { collectGame, makeConfig } from '../core/collector/engine.mjs';
import { createJobRepository } from '../core/jobs/sqlite.mjs';

const archiver = createRequire(import.meta.url)('archiver');

const args = process.argv.slice(2);
const url = args.find(x => !x.startsWith('-')) || process.env.GAME_URL;
const value = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
if (!url) { console.error('Usage: npm run collect:local -- https://game.example [--out out/local] [--play-seconds 90] [--spins 30]'); process.exit(2); }
const out = resolve(value('out', process.env.OUT || 'out/local'));
const env = { ...process.env, GAME_URL: url, OUT: out, PLAY_SECONDS: value('play-seconds', process.env.PLAY_SECONDS || '90'), SPINS: value('spins', process.env.SPINS || '30'), SPIN_X: value('spin-x', process.env.SPIN_X || ''), SPIN_Y: value('spin-y', process.env.SPIN_Y || ''), CRAWL: value('crawl', process.env.CRAWL || '1'), CRAWL_MAX: value('crawl-max', process.env.CRAWL_MAX || '400'), HAR: value('har', process.env.HAR || '0'), COOKIES: process.env.COOKIES || '' };
const config = makeConfig(env), jobId = randomUUID(), dbPath = resolve(process.env.CZIPERR_JOBS_DB || '.c-ziperr/jobs.sqlite');
const repo = createJobRepository(dbPath); repo.create({ id: jobId, url: config.gameUrl, output: out });
const update = (p) => { const pct = p.phase === 'interaction' ? Math.round((p.spin / Math.max(p.spins, 1)) * 70) : p.phase === 'cdn-crawl' ? 80 + Math.round((p.crawled / Math.max(p.max, 1)) * 15) : 10; repo.update(jobId, { status: 'running', phase: p.phase, pct, checkpoint: JSON.stringify(p) }); repo.event(jobId, { phase: p.phase, pct, message: JSON.stringify(p), payload: p }); console.log(JSON.stringify({ jobId, ...p, pct })); };
async function zipDirectory(directory, destination) { await mkdir(resolve(destination, '..'), { recursive: true }); await new Promise((resolvePromise, reject) => { const output = createWriteStream(destination); const archive = new archiver.ZipArchive({ zlib: { level: 9 } }); output.on('close', resolvePromise); output.on('error', reject); archive.on('error', reject); archive.pipe(output); archive.directory(directory, false); archive.finalize(); }); }
try {
  console.log(`Local collect: ${config.gameUrl} → ${out} (job ${jobId})`);
  const report = await collectGame(config, { chromium, onProgress: update });
  const zip = resolve(value('zip', join(out, '..', `${jobId}.zip`))); await zipDirectory(out, zip);
  const info = await stat(zip), sha256 = createHash('sha256').update(await (await import('node:fs/promises')).readFile(zip)).digest('hex');
  repo.addArtifact(jobId, { path: zip, size: info.size, sha256, kind: 'zip' }); repo.update(jobId, { status: 'completed', phase: 'export', pct: 100, checkpoint: JSON.stringify({ zip, sha256 }) }); repo.event(jobId, { phase: 'export', pct: 100, message: 'ZIP selesai', payload: { zip, sha256, size: info.size } });
  console.log(`Selesai. job=${jobId} zip=${zip} size=${info.size} sha256=${sha256} file=${report.total} api=${report.layers.api} cdn=${report.layers.cdn}`);
} catch (error) {
  repo.update(jobId, { status: 'error', phase: 'error', error: String(error.message || error) }); repo.event(jobId, { phase: 'error', message: String(error.message || error) }); console.error(error); process.exitCode = 1;
} finally { repo.close(); }
