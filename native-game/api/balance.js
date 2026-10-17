/**
 * GET /api/game/balance — read ledger for offline native package.
 */
import { getLedgerSnapshot } from "./spin.js";

/**
 * @param {Request} request
 * @param {{ sessionId?: string }} [ctx]
 */
export async function handleBalance(request, ctx = {}) {
  const url = new URL(request.url);
  const sessionId =
    ctx.sessionId ||
    url.searchParams.get("sessionId") ||
    request.headers.get("X-Session-Id") ||
    "player1";

  const ledger = getLedgerSnapshot(sessionId);
  return Response.json({
    ok: true,
    sessionId,
    balance: ledger.balance,
    spinCount: ledger.spinCount,
    totalWin: ledger.totalWin,
    totalBet: ledger.totalBet,
    lastSpin: ledger.lastSpin,
    currency: "points",
    server_timestamp: new Date().toISOString(),
  });
}
