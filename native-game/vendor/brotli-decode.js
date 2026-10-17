/**
 * Minimal Brotli decode stub.
 * For production offline packages, replace with a real decoder such as:
 *   https://github.com/google/brotli/tree/master/js
 * or brotli-wasm, exporting:
 *   export default function decode(uint8Array) { return decompressedUint8Array; }
 *
 * This stub fails loudly so missing setup is obvious during validation.
 */

export default function decode(_bytes) {
  throw new Error(
    "[C_Ziperr] Real Brotli decoder not bundled. Replace native-game/vendor/brotli-decode.js " +
      "with google/brotli JS decode, or ship uncompressed 74.wasm / 74.data."
  );
}

export { decode };
