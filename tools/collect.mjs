import { chromium } from 'playwright';
import { collectGame, makeConfig } from '../core/collector/engine.mjs';

const report = await collectGame(makeConfig(process.env), { chromium, onProgress: p => console.log(JSON.stringify(p)) });
console.log(`Selesai. file=${report.total} api=${report.layers.api} cdn=${report.layers.cdn} domain=${report.cdn.totalDomains} gagal=${report.failed.length}`);
