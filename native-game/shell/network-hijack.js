/**
 * Hijack XHR / WebSocket / fetch that still point at eajzzxhro.com
 * and redirect gameplay calls to local /api/game/*.
 */
const REMOTE = /eajzzxhro\.com/i;
const API_SPIN = /\/(?:74(?:a|b)?\/)?api\/(?:spin|result|play)/i;
const API_BALANCE = /\/(?:74(?:a|b)?\/)?api\/balance/i;

function toLocalApi(url) {
  const u = String(url || "");
  if (API_BALANCE.test(u)) return "/api/game/balance";
  if (API_SPIN.test(u) || /\/api\//i.test(u)) return "/api/game/spin";
  return null;
}

export function installNetworkHijack() {
  if (typeof window === "undefined" || window.__cZiperrHijackInstalled) return;
  window.__cZiperrHijackInstalled = true;

  // fetch
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = input?.url || input;
    if (REMOTE.test(String(url))) {
      const local = toLocalApi(url);
      if (local) {
        const method = (init?.method || "GET").toUpperCase();
        const headers = new Headers(init?.headers || {});
        if (!headers.has("X-Idempotency-Key") && method === "POST") {
          headers.set("X-Idempotency-Key", crypto.randomUUID());
        }
        return origFetch(local, { ...init, method, headers });
      }
      console.warn("[C_Ziperr] blocked remote fetch", url);
      return Promise.reject(new Error("Remote host blocked (offline)"));
    }
    return origFetch(input, init);
  };

  // XHR
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (REMOTE.test(String(url))) {
      const local = toLocalApi(url);
      if (local) {
        arguments[1] = local;
      }
    }
    return origOpen.apply(this, arguments);
  };

  // WebSocket → synthetic object that POSTs to /api/game/spin
  const OrigWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    if (REMOTE.test(String(url))) {
      console.log("[C_Ziperr] WS hijacked → /api/game/spin");
      const fake = {
        readyState: 1,
        bufferedAmount: 0,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
        send(data) {
          fetch("/api/game/spin", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Idempotency-Key": crypto.randomUUID(),
            },
            body: typeof data === "string" ? data : JSON.stringify(data),
          })
            .then((r) => r.json())
            .then((j) => {
              if (typeof fake.onmessage === "function") {
                fake.onmessage({ data: JSON.stringify(j) });
              }
            })
            .catch((err) => {
              if (typeof fake.onerror === "function") fake.onerror(err);
            });
        },
        close() {
          fake.readyState = 3;
          if (typeof fake.onclose === "function") fake.onclose({});
        },
        addEventListener(type, cb) {
          if (type === "message") fake.onmessage = cb;
          if (type === "open") fake.onopen = cb;
          if (type === "close") fake.onclose = cb;
          if (type === "error") fake.onerror = cb;
        },
        removeEventListener() {},
      };
      setTimeout(() => {
        if (typeof fake.onopen === "function") fake.onopen({});
      }, 0);
      return fake;
    }
    return new OrigWS(url, protocols);
  };
  window.WebSocket.prototype = OrigWS.prototype;
  Object.assign(window.WebSocket, {
    CONNECTING: OrigWS.CONNECTING,
    OPEN: OrigWS.OPEN,
    CLOSING: OrigWS.CLOSING,
    CLOSED: OrigWS.CLOSED,
  });
}

if (typeof window !== "undefined") {
  installNetworkHijack();
}
