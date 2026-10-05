const path = require('path');
const { readText } = require('./collector');

function attr(tag, name) { const m = tag.match(new RegExp(`android:${name}=["']([^"']+)["']`, 'i')); return m ? m[1] : null; }
function assessManifest(file) {
  const xml = readText(file); if (!xml) return [];
  const findings = [];
  const app = xml.match(/<application\b[^>]*>/i)?.[0] || '';
  if (/android:debuggable=["']true["']/i.test(app)) findings.push({ id:'manifest-debuggable', severity:'HIGH', title:'Application is debuggable', file, recommendation:'Set android:debuggable="false" for release builds.' });
  if (/android:allowBackup=["']true["']/i.test(app)) findings.push({ id:'manifest-backup', severity:'MEDIUM', title:'Application backup is enabled', file, recommendation:'Review android:allowBackup and dataExtractionRules for sensitive data.' });
  if (/android:usesCleartextTraffic=["']true["']/i.test(app)) findings.push({ id:'manifest-cleartext', severity:'HIGH', title:'Cleartext traffic is permitted', file, recommendation:'Disable cleartext traffic and define a restrictive Network Security Config.' });
  const components = xml.match(/<(activity|activity-alias|service|receiver|provider)\b[^>]*>/gi) || [];
  for (const tag of components) {
    const exported = attr(tag, 'exported');
    const permission = attr(tag, 'permission');
    if (exported === 'true' && !permission) findings.push({ id:'exported-component', severity:'MEDIUM', title:'Exported Android component has no permission', file, evidence:tag.slice(0,180), recommendation:'Validate intent input and protect the component with an appropriate permission where applicable.' });
  }
  const perms = [...xml.matchAll(/<uses-permission\b[^>]*android:name=["']([^"']+)["']/gi)].map(m=>m[1]);
  for (const p of perms) if (/READ_SMS|RECEIVE_SMS|RECORD_AUDIO|READ_CONTACTS|ACCESS_FINE_LOCATION/i.test(p)) findings.push({ id:'sensitive-permission', severity:'LOW', title:'Sensitive Android permission declared', file, evidence:p, recommendation:'Confirm the permission is necessary and disclose its use.' });
  return findings;
}
function findManifest(files) { return files.filter(f => path.basename(f.path).toLowerCase() === 'androidmanifest.xml'); }
module.exports = { assessManifest, findManifest };
