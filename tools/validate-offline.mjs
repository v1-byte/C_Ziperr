#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validateOffline } from '../core/offline/validator.mjs';
const root = resolve(process.argv[2] || '.'); const report = await validateOffline(root); await writeFile(join(root, 'offline-readiness.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); if (report.status === 'NOT_READY') process.exitCode = 1;
