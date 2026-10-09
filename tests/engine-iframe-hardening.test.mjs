import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEngineRepairs } from '../src/repair/engine-fix.js';
import { rewriteIframeMarkup } from '../src/package/iframe-rewriter.js';

test('engine-specific URL repair applies only relevant engine patch', () => {
  const result = applyEngineRepairs('this.load.setBaseURL("https://cdn.example.test/game/");', 'phaser', 'assets/game.js');
  assert.match(result.text, /setBaseURL\("\.\/"\)/);
  assert.ok(result.fixes.includes('phaser-setBaseURL-relative'));
});

test('iframe pathological dimensions are clamped and existing sandbox remains', () => {
  const result = rewriteIframeMarkup('<iframe width="999999" height="999999" style="width:999999px;height:999999px" src="/play"></iframe>', { baseUrl: 'https://example.test/' });
  assert.match(result.html, /width="100%"/);
  assert.match(result.html, /height="100vh"/);
  assert.match(result.html, /max-width:100%/);
  assert.match(result.html, /sandbox=/);
});
