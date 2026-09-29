#!/usr/bin/env node
import { resolve } from 'node:path';
import { loadMockRules, createMockApiServer } from '../core/server/mock-api.mjs';
const root = resolve(process.argv[2] || '.'); const rules = await loadMockRules(root); const mock = createMockApiServer({ rules, port: Number(process.env.PORT || 0) }); const info = await mock.start(); console.log(JSON.stringify({ ok: true, rules: rules.length, ...info, health: info.url + '/__health' }));
const stop = async () => { await mock.stop(); process.exit(0); }; process.on('SIGINT', stop); process.on('SIGTERM', stop);
