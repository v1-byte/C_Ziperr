const { RULES } = require('./rules');
const { readText } = require('./collector');
function detect(file) {
  const content = readText(file); if (content === null) return [];
  const out = [];
  for (const rule of RULES.filter(r => r.tag)) if (rule.pattern.test(content)) out.push({ id:rule.id, severity:rule.severity, title:rule.title, tag:rule.tag, file });
  return out;
}
function summary(findings) {
  const tags = [...new Set(findings.filter(f=>f.tag).map(f=>f.tag))];
  return { detected: tags, drm: tags.includes('DRM'), integrity: tags.includes('INTEGRITY'), keystore: tags.includes('KEYSTORE'), runtime: tags.includes('RUNTIME') };
}
module.exports = { detect, summary };
