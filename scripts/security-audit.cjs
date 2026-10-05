#!/usr/bin/env node
const path = require('path');
const { audit } = require('../src/security/security-engine');
const { reports } = require('../src/security/report-engine');
const args = process.argv.slice(2); const target = args.find(a=>!a.startsWith('--'));
if (!target) { console.log('Usage: node scripts/security-audit.js <target> [--deep] [--json <file>]'); process.exit(1); }
const report = audit(target);
const out = path.resolve('audit/reports'); const generated = reports(report,out);
if (args.includes('--json')) { const file=args[args.indexOf('--json')+1]; if (file) require('fs').writeFileSync(path.resolve(file),JSON.stringify(report,null,2)); }
console.log(`C_Ziperr DRM Security Assessment\nScore: ${report.score}/100\nRisk: ${report.risk}\nFiles: ${report.scannedFiles}\nFindings: ${report.statistics.findings}\nProtection: ${report.protection.detected.join(', ')||'None'}\nJSON: ${generated.json}\nHTML: ${generated.html}`);
