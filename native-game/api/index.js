/**
 * Router for /api/game/* used by native offline package / Worker adapter.
 */
import { handleSpin } from "./spin.js";
import { handleBalance } from "./balance.js";

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function handleGameApi(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && (path.endsWith("/balance") || path === "/api/game/balance")) {
    return handleBalance(request);
  }
  if (request.method === "POST" && (path.endsWith("/spin") || path === "/api/game/spin")) {
    return handleSpin(request);
  }
  if (request.method === "GET" && (path.endsWith("/health") || path === "/api/game/health")) {
    return Response.json({ ok: true, service: "native-game-api", kv: "memory" });
  }
  if (request.method === "GET" && (path.endsWith("/history") || path === "/api/game/history")) {
    const sessionId = url.searchParams.get("sessionId") || "player1";
    const { getLedgerSnapshot } = await import("./spin.js");
    const ledger = getLedgerSnapshot(sessionId);
    return Response.json({
      ok: true,
      sessionId,
      items: ledger.lastSpin ? [ledger.lastSpin] : [],
    });
  }

  return Response.json({ error: "NOT_FOUND", path }, { status: 404 });
}

export { handleSpin, handleBalance };
