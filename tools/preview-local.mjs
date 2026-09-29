#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createPreviewServer } from '../core/server/preview.mjs';

const input = process.argv[2]; if (!input) { console.error('Usage: npm run preview:local -- ./artifact-directory'); process.exit(2); }
const root = resolve(input), preview = createPreviewServer({ root, port: Number(process.env.PORT || 0) });
const info = await preview.start(); console.log(JSON.stringify({ ok: true, ...info, health: info.url + '/__health' }));
const stop = async () => { await preview.stop(); process.exit(0); }; process.on('SIGINT', stop); process.on('SIGTERM', stop);
