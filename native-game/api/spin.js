/**
 * Server-authoritative demo spin for offline native package.
 * Idempotent via X-Idempotency-Key / body.idempotency_key.
 * Ledger lives in memory (Worker/KV binding can replace Map at deploy time).
 */

const ALLOWED_BETS = new Set([100, 200, 500, 1000]);
const SYMBOLS = ["A", "K", "Q", "J", "10", "WILD", "SCATTER"];

/** @type {Map<string, any>} */
const idempotency = new Map();
/** @type {Map<string, { balance: number, spinCount: number, totalWin: number, totalBet: number, lastSpin: any }>} */
const ledgers = new Map();

function uuid() {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getLedger(sessionId) {
  if (!ledgers.has(sessionId)) {
    ledgers.set(sessionId, {
      balance: 10000,
      spinCount: 0,
      totalWin: 0,
      totalBet: 0,
      lastSpin: null,
    });
  }
  return ledgers.get(sessionId);
}

function seededRandom(seed) {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMatrix(rng) {
  // 5 reels x 3 visible
  const matrix = [];
  for (let r = 0; r < 5; r++) {
    const col = [];
    for (let row = 0; row < 3; row++) {
      col.push(SYMBOLS[Math.floor(rng() * SYMBOLS.length)]);
    }
    matrix.push(col);
  }
  return matrix;
}

function evaluateWin(matrix, bet) {
  // Demo: simple horizontal line match
  let total = 0;
  for (let row = 0; row < 3; row++) {
    const first = matrix[0][row];
    let count = 1;
    for (let r = 1; r < 5; r++) {
      if (matrix[r][row] === first || matrix[r][row] === "WILD" || first === "WILD") count++;
      else break;
    }
    if (count >= 3) {
      const mult = count === 5 ? 20 : count === 4 ? 5 : 2;
      total += bet * mult;
    }
  }
  return total;
}

/**
 * Handle POST /api/game/spin
 * @param {Request} request
 * @param {{ sessionId?: string }} [ctx]
 */
export async function handleSpin(request, ctx = {}) {
  const sessionId = ctx.sessionId || request.headers.get("X-Session-Id") || "player1";
  const key =
    request.headers.get("X-Idempotency-Key") ||
    request.headers.get("Idempotency-Key") ||
    "";

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const idem = key || body.idempotency_key || body.request_id || uuid();
  if (idempotency.has(idem)) {
    return Response.json(idempotency.get(idem));
  }

  const bet = Number(body.bet ?? 100);
  if (!ALLOWED_BETS.has(bet)) {
    return Response.json({ error: "BET_OUT_OF_RANGE", allowed: [...ALLOWED_BETS] }, { status: 400 });
  }

  const ledger = getLedger(sessionId);
  if (ledger.balance < bet) {
    return Response.json({ error: "INSUFFICIENT_BALANCE", balance: ledger.balance }, { status: 422 });
  }

  const rng = seededRandom(`${sessionId}:${ledger.spinCount}:${idem}`);
  const matrix = buildMatrix(rng);
  const win = evaluateWin(matrix, bet);

  ledger.balance = ledger.balance - bet + win;
  ledger.spinCount += 1;
  ledger.totalBet += bet;
  ledger.totalWin += win;
  ledger.lastSpin = { matrix, bet, win, at: Date.now() };

  const payload = {
    ok: true,
    sessionId,
    idempotency_key: idem,
    bet,
    win,
    balance: ledger.balance,
    spinCount: ledger.spinCount,
    matrix,
    server_timestamp: new Date().toISOString(),
  };

  idempotency.set(idem, payload);
  return Response.json(payload);
}

export function getLedgerSnapshot(sessionId = "player1") {
  return { ...getLedger(sessionId) };
}

export { ledgers, idempotency };
