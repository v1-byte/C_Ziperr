/**
 * Offline loader for .br / .gz compressed Unity/Phaser assets.
 * - .gz → DecompressionStream('gzip') when available
 * - .br → optional vendor decoder, else tries fetch with Accept-Encoding
 *
 * Include early: <script type="module" src="./shell/brotli-loader.js"></script>
 */

const originalFetch = globalThis.fetch.bind(globalThis);

async function decompressGzip(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream not available");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Optional external decoder: window.__brotliDecode(Uint8Array) => Uint8Array */
async function decompressBrotli(bytes) {
  if (typeof globalThis.__brotliDecode === "function") {
    return globalThis.__brotliDecode(bytes);
  }
  // Dynamic optional vendor (place file at ./vendor/brotli-decode.js exporting default decode)
  try {
    const mod = await import("../vendor/brotli-decode.js");
    const decode = mod.default || mod.decode || mod.brotliDecode;
    if (typeof decode === "function") {
      globalThis.__brotliDecode = decode;
      return decode(bytes);
    }
  } catch (_) {}
  throw new Error(
    "Brotli decoder missing. Add native-game/vendor/brotli-decode.js or serve uncompressed .wasm/.data"
  );
}

function isCompressedAsset(url) {
  const s = String(url || "");
  return /\.(br)(?:\?|$)/i.test(s) || /\.(gz)(?:\?|$)/i.test(s);
}

globalThis.fetch = async function patchedFetch(input, init) {
  const url = input?.url || input;
  const href = String(url || "");

  if (!isCompressedAsset(href)) {
    return originalFetch(input, init);
  }

  const res = await originalFetch(input, init);
  if (!res.ok) return res;

  const buf = new Uint8Array(await res.arrayBuffer());
  let decompressed;
  if (/\.gz(?:\?|$)/i.test(href)) {
    decompressed = await decompressGzip(buf);
  } else {
    decompressed = await decompressBrotli(buf);
  }

  const headers = new Headers(res.headers);
  headers.delete("content-encoding");
  headers.set("content-length", String(decompressed.byteLength));
  // Hint content-type for wasm/data
  if (/\.wasm\.br(?:\?|$)/i.test(href) || /\.wasm\.gz(?:\?|$)/i.test(href)) {
    headers.set("content-type", "application/wasm");
  }

  return new Response(decompressed, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};

export function installBrotliLoader() {
  return true;
}

console.info("[C_Ziperr] brotli/gzip fetch loader active");
