import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

function countMatches(text, expression) {
  return (text.match(expression) || []).length;
}

test('header contains three continuously orbiting atoms and respects reduced motion', () => {
  const header = html.match(/<header>[\s\S]*?<\/header>/)?.[0] || '';
  assert.match(header, /class="gc-atom-chain"/);
  assert.equal(countMatches(header, /class="gc-atom-node"/g), 3);
  assert.match(html, /animation:\s*gc-atom-orbit-spin[^;]*infinite/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
});

test('capture loader shows three linked rings and the actual remaining percentage', () => {
  assert.match(html, /id="gc-capture-atom-loader"[^>]*hidden/);
  assert.equal(countMatches(html, /class="gc-capture-loader-ring"/g), 3);
  assert.match(html, /id="gc-capture-remaining-percent"/);
  assert.match(html, /100\s*-\s*Math\.round\(value\)/);
  assert.match(html, /__gcUnifiedCaptureRunning\s*&&\s*value\s*!=\s*null/);
});

test('capture cockpit has layered motion and keeps reduced-motion fallback', () => {
  assert.match(html, /gc-card-enter/);
  assert.match(html, /gc-live-breathe/);
  assert.match(html, /gc-progress-shimmer/);
  assert.match(html, /gc-cockpit-card:hover/);
  assert.match(html, /gc-capture-live-panel, \.gc-capture-progress-bar/);
});

test('AI readiness flow exposes three visible stages and actionable states', () => {
  assert.match(html, /id="collect-ai-assist"/);
  assert.equal(countMatches(html, /class="collect-ai-step(?: |")/g), 3);
  assert.match(html, /data-ai-step="1"/);
  assert.match(html, /data-ai-step="2"/);
  assert.match(html, /data-ai-step="3"/);
  assert.match(html, /Audit lokal selesai\. AI sedang menyusun diagnosis/);
  assert.match(html, /classList\.toggle\('is-working'/);
  assert.match(html, /classList\.toggle\('is-error'/);
});
