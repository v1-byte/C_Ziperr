#!/usr/bin/env node
import { resolve } from 'node:path';
import { rewritePackage } from '../core/repair/rewriter.mjs';
const [root, from, to, mode] = process.argv.slice(2); if (!root || !from || !to) { console.error('Usage: npm run rewrite:package -- ./dir OLD_URL NEW_URL [--dry-run]'); process.exit(2); }
console.log(JSON.stringify(await rewritePackage(resolve(root), { from, to, dryRun: mode === '--dry-run' }), null, 2));
