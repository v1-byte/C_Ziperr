const test = require('node:test'); const assert = require('node:assert/strict'); const { score, risk } = require('../../src/security/security-engine');
test('risk scoring',()=>{ assert.equal(score([{severity:'HIGH'}]),82); assert.equal(risk(92),'LOW'); assert.equal(risk(45),'HIGH'); });
