import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../app/index.tsx', import.meta.url), 'utf8');
const match = source.match(/const DOWNLOAD_BRIDGE = `([\s\S]*?)`;\n/);
assert.ok(match, 'download bridge is present');
const bridge = match[1].replace('${DOWNLOAD_CHUNK_BYTES}', String(192 * 1024));
const decoderMatch = source.match(/function decodeBase64Chunk\(value: string\) \{[\s\S]*?\n\}/);
assert.ok(decoderMatch, 'native Base64 decoder is present');
const decoderSource = decoderMatch[0].replace('(value: string)', '(value)');
const decodeBase64Chunk = vm.runInNewContext(`(${decoderSource})`);

for (const size of [1, 2, 3, 4, 5, 192 * 1024 - 1, 192 * 1024]) {
  const bytes = Buffer.alloc(size);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 13 + 9) & 0xff;
  assert.deepEqual(Buffer.from(decodeBase64Chunk(bytes.toString('base64'))), bytes, `native decoder preserves ${size} bytes`);
}
assert.throws(() => decodeBase64Chunk('not-base64!'), /tidak valid/i);

const expected = Buffer.alloc(1_137_777);
for (let index = 0; index < expected.length; index += 1) expected[index] = (index * 31 + 17) & 0xff;
const receivedChunks = [];
const messageTypes = [];
let expectedSize = 0;
let pendingMessages = 0;
let maxPendingMessages = 0;
let resolveComplete;
let rejectComplete;
const completed = new Promise((resolve, reject) => {
  resolveComplete = resolve;
  rejectComplete = reject;
});

class FakeAnchor {
  constructor(href, download) {
    this.href = href;
    this.download = download;
  }
  click() {
    this.fallbackClicked = true;
  }
}

class FakeFileReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:application/octet-stream;base64,${Buffer.from(buffer).toString('base64')}`;
      this.onload?.();
    }).catch((error) => this.onerror?.(error));
  }
}

const window = {};
window.ReactNativeWebView = {
  postMessage(raw) {
    const message = JSON.parse(raw);
    messageTypes.push(message.type);
    pendingMessages += 1;
    maxPendingMessages = Math.max(maxPendingMessages, pendingMessages);
    setTimeout(() => {
      try {
        if (message.type === 'save_internal_download_start') {
          expectedSize = message.size;
          assert.equal(message.filename, 'large-result.zip');
          window.__CZIPERR_DOWNLOAD_ACK({ id: message.id, index: -1 });
        } else if (message.type === 'save_internal_download_chunk') {
          const bytes = Buffer.from(message.base64, 'base64');
          assert.ok(bytes.byteLength <= 192 * 1024, 'each message stays within the configured chunk size');
          receivedChunks.push(bytes);
          window.__CZIPERR_DOWNLOAD_ACK({ id: message.id, index: message.index });
        } else if (message.type === 'save_internal_download_complete') {
          const actual = Buffer.concat(receivedChunks);
          assert.equal(message.size, expectedSize);
          assert.equal(actual.byteLength, expectedSize);
          assert.deepEqual(actual, expected);
          resolveComplete(actual);
          window.__CZIPERR_DOWNLOAD_ACK({ id: message.id, index: message.chunks });
        } else if (message.type === 'save_internal_download_error') {
          rejectComplete(new Error(message.message));
        }
      } catch (error) {
        rejectComplete(error);
      } finally {
        pendingMessages -= 1;
      }
    }, 0);
  },
};

const context = {
  window,
  HTMLAnchorElement: FakeAnchor,
  FileReader: FakeFileReader,
  fetch: async () => ({ ok: true, blob: () => Promise.resolve(new Blob([expected])) }),
  setTimeout,
  clearTimeout,
};
vm.runInNewContext(bridge, context, { timeout: 1000 });

const anchor = new FakeAnchor('blob:https://c-zipper.example/export', 'large-result.zip');
anchor.click();
await Promise.race([
  completed,
  new Promise((_, reject) => setTimeout(() => reject(new Error('download bridge test timed out')), 5000)),
]);

assert.ok(receivedChunks.length >= 5, 'large ZIP is split into multiple bounded chunks');
assert.equal(maxPendingMessages, 1, 'ACK provides back-pressure; only one bridge message is in flight');
assert.equal(anchor.fallbackClicked, undefined, 'successful internal save does not fall back to a browser download');
assert.equal(messageTypes[0], 'save_internal_download_start');
assert.equal(messageTypes.at(-1), 'save_internal_download_complete');
assert.ok(messageTypes.slice(1, -1).every((type) => type === 'save_internal_download_chunk'));

console.log(`internal ZIP transfer protocol passed (${expectedSize} bytes, ${receivedChunks.length} chunks, one in-flight message)`);
