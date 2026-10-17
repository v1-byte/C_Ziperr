/**
 * Offline debug panel — logs blocked vs allowed network calls.
 * Include: <script src="./debug-panel.js"></script>
 */
(function () {
  if (typeof document === "undefined") return;
  if (document.getElementById("c-ziperr-debug")) return;

  const panel = document.createElement("div");
  panel.id = "c-ziperr-debug";
  panel.style.cssText =
    "position:fixed;bottom:0;left:0;width:100%;background:rgba(0,0,0,0.9);color:lime;padding:10px;font-family:monospace;z-index:99999;max-height:200px;overflow:auto;font-size:12px";
  panel.innerHTML =
    '<b>[C_Ziperr Debug] Offline Check</b> <button id="c-ziperr-debug-clear" style="margin-left:8px">clear</button><div id="debug-log"></div>';
  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(panel);
    document.getElementById("c-ziperr-debug-clear")?.addEventListener("click", () => {
      const el = document.getElementById("debug-log");
      if (el) el.innerHTML = "";
    });
  });
  // If already loaded
  if (document.body) {
    document.body.appendChild(panel);
  }

  const log = (msg) => {
    const el = document.getElementById("debug-log");
    if (el) el.innerHTML += msg + "<br>";
    console.log("[C_Ziperr]", msg);
  };

  const BLOCK_HOST = /eajzzxhro\.com/i;

  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const url = String(args[0]?.url || args[0] || "");
    if (BLOCK_HOST.test(url)) {
      log("❌ BLOCKED fetch: " + url);
      return Promise.reject(new Error("Blocked by C_Ziperr offline policy"));
    }
    log("✅ OK fetch: " + url.slice(0, 120));
    return origFetch.apply(this, args);
  };

  const OrigWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    const u = String(url || "");
    if (BLOCK_HOST.test(u)) {
      log("❌ WS BLOCKED: " + u);
      return {
        send() {},
        close() {},
        addEventListener() {},
        removeEventListener() {},
        readyState: 3,
      };
    }
    log("✅ WS OK: " + u.slice(0, 120));
    return new OrigWS(url, protocols);
  };
  window.WebSocket.prototype = OrigWS.prototype;
  window.WebSocket.OPEN = OrigWS.OPEN;
  window.WebSocket.CLOSED = OrigWS.CLOSED;

  fetch("./manifests/asset-manifest.json")
    .then((r) => r.json())
    .then((m) => {
      const total = m.totalFiles || m.assets?.length || "?";
      log("📦 assets: " + total + " offlineReady=" + (m.offlineReady ?? m.schema_version));
    })
    .catch(() => log("📦 asset-manifest not found (ok in shell-only mode)"));
})();
