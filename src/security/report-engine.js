const fs = require('fs'); const path = require('path');
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function reports(report, dir) {
  fs.mkdirSync(dir,{recursive:true});
  const json=path.join(dir,'security-report.json'), html=path.join(dir,'security-report.html');
  fs.writeFileSync(json,JSON.stringify(report,null,2));
  const rows=report.findings.map(f=>`<tr><td>${esc(f.severity)}</td><td>${esc(f.title)}</td><td>${esc(f.file)}</td><td>${esc(f.recommendation||'')}</td></tr>`).join('');
  fs.writeFileSync(html,`<!doctype html><meta charset="utf-8"><title>C_Ziperr DRM Report</title><style>body{font-family:system-ui;background:#08111f;color:#e5efff;padding:28px}.card{background:#101e32;padding:18px;border-radius:12px;margin:12px 0}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #28405e;text-align:left}</style><h1>C_Ziperr DRM Security Assessment</h1><div class="card"><b>Score:</b> ${report.score}/100<br><b>Risk:</b> ${esc(report.risk)}<br><b>Scanned files:</b> ${report.scannedFiles}<br><b>Protection:</b> ${esc(report.protection.detected.join(', ')||'None')}</div><div class="card"><h2>Findings</h2><table><tr><th>Severity</th><th>Finding</th><th>File</th><th>Recommendation</th></tr>${rows}</table></div>`);
  return {json,html};
}
module.exports={reports};
