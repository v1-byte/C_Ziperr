#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { scanPackage } from '../core/analyze/dependencies.mjs';
const root = resolve(process.argv[2] || '.'); const report = await scanPackage(root); await writeFile(join(root, 'asset-manifest.json'), JSON.stringify({ generatedAt: report.generatedAt, files: report.files, assets: report.assets, duplicates: report.duplicates }, null, 2)); await writeFile(join(root, 'dependency-graph.json'), JSON.stringify({ generatedAt: report.generatedAt, edges: report.edges, externalUrls: report.externalUrls, features: report.features }, null, 2)); console.log(JSON.stringify(report, null, 2));
