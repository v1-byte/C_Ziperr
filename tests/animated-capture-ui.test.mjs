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

test('capture loader uses the supplied glowing core image instead of the Rubik cube', () => {
  assert.match(html, /src="\/assets\/capture-core\.jpg"/);
  assert.match(html, /gc-capture-core-glow/);
  assert.doesNotMatch(html, /gc-rubik-cube|gc-rubik-face/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
});

test('large-capture UI documents runner bounds and dispatches through Actions', () => {
  assert.match(html, /Capture berjalan di runner GitHub Actions, bukan browser Worker/);
  assert.match(html, /large_capture:\s*opts\.large_capture/);
  assert.match(html, /async function gcRunCaptureCoach/);
  assert.match(html, /Jangan menyertakan URL lengkap atau query/);
});

test('the supplied capture-core image is available as a local static asset', async () => {
  const image = await readFile(new URL('../public/assets/capture-core.jpg', import.meta.url));
  assert.ok(image.byteLength > 10_000);
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
