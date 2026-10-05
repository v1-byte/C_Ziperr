const path = require('path');
const { walk, readText } = require('./collector');
const { RULES } = require('./rules');
const { detect, summary } = require('./drm-detector');
const { assessManifest, findManifest } = require('./android-assessor');

const PENALTY = { CRITICAL:30, HIGH:18, MEDIUM:8, LOW:3, INFO:0 };
function generalScan(file) {
  const content = readText(file.path); if (content === null) return [];
  return RULES.filter(r => !r.tag && r.pattern.test(content)).map(r => ({ id:r.id, severity:r.severity, title:r.title, file:file.path, recommendation: recommendation(r.id) }));
}
function recommendation(id) {
  const map = {
    'private-key':'Revoke and rotate the key immediately; move private material to a secret manager or signing system.',
    'aws-access-key':'Revoke/rotate the credential and use workload identity or a secret manager.',
    'github-token':'Revoke/rotate the token and remove it from source history where possible.',
    'hardcoded-api-key':'Move the credential to a managed secret and restrict it by app, API, and environment.',
    'hardcoded-secret':'Move the secret to a managed secret store and rotate it.',
    'jwt':'Do not commit live tokens; rotate if this token is active.',
    'cleartext-http':'Use HTTPS and enforce it through Network Security Config.',
    'debug-enabled':'Disable debugging in production builds.'
  }; return map[id] || 'Review this finding in context.';
}
function score(findings) { return Math.max(0, 100 - findings.reduce((n,f)=>n+(PENALTY[f.severity]||0),0)); }
function risk(n) { return n >= 90 ? 'LOW' : n >= 70 ? 'MEDIUM' : n >= 40 ? 'HIGH' : 'CRITICAL'; }
function audit(target) {
  const root = path.resolve(target); const files = walk(root); let findings = [];
  for (const file of files) { findings.push(...generalScan(file)); findings.push(...detect(file.path)); }
  for (const mf of findManifest(files)) findings.push(...assessManifest(mf.path));
  const s = score(findings);
  const bySeverity = Object.fromEntries(['CRITICAL','HIGH','MEDIUM','LOW','INFO'].map(x=>[x, findings.filter(f=>f.severity===x).length]));
  return { target:root, generatedAt:new Date().toISOString(), scannedFiles:files.length, integrityManifest:files.map(f=>({file:f.relative,sha256:f.sha256,size:f.size})), protection:summary(findings), score:s, risk:risk(s), statistics:{findings:findings.length, bySeverity}, findings };
}
module.exports = { audit, score, risk };
