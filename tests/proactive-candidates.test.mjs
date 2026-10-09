import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProactiveCandidates } from '../src/collect/proactive-candidates.js';

test('proactive candidate scan traverses HTML, CSS, JS, and runtime references', () => {
  const found = extractProactiveCandidates([
    { baseUrl: 'https://game.example.test/play/index.html', text: '<script src="./app.js"></script><img srcset="//cdn.example.test/a.avif 1x, //cdn.example.test/b.webp 2x">' },
    { baseUrl: 'https://cdn.example.test/css/site.css', text: '.font{src:url(../fonts/game.woff2)} .bg{background:url(../img/bg.png)}' },
    { baseUrl: 'https://cdn.example.test/js/app.js', text: 'import "./engine.unityweb"; const a="https://cdn.example.test/audio/theme.m4a";' }
  ], ['https://cdn.example.test/video/intro.webm#fragment']);
  assert.ok(found.includes('https://game.example.test/play/app.js'));
  assert.ok(found.includes('https://cdn.example.test/a.avif'));
  assert.ok(found.includes('https://cdn.example.test/b.webp'));
  assert.ok(found.includes('https://cdn.example.test/fonts/game.woff2'));
  assert.ok(found.includes('https://cdn.example.test/img/bg.png'));
  assert.ok(found.includes('https://cdn.example.test/js/engine.unityweb'));
  assert.ok(found.includes('https://cdn.example.test/audio/theme.m4a'));
  assert.ok(found.includes('https://cdn.example.test/video/intro.webm'));
});

test('proactive candidate scan filters API/tracking and enforces its bound', () => {
  const found = extractProactiveCandidates([
    { baseUrl: 'https://game.example.test/', text: '<img src="/assets/a.png"><img src="/assets/b.png"><img src="/assets/c.png"><img src="/game-api/spin.json"><img src="https://www.google-analytics.com/collect.js">' }
  ], [], 2);
  assert.equal(found.length, 2);
  assert.ok(found.every((url) => !url.includes('game-api') && !url.includes('google-analytics')));
});
