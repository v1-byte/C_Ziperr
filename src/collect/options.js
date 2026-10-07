const DEFAULTS = {
  waitSeconds: 22,
  autoSpins: 6,
  autoHistory: true,
  spinDelayMs: 2200
};

function boundedInteger(value, fallback, { min, max }) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function parseBooleanOption(value, fallback = true) {
  if (value == null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  return fallback;
}

export function normalizeCollectOptions(env = {}) {
  return {
    waitSeconds: boundedInteger(env.WAIT_SECONDS, DEFAULTS.waitSeconds, { min: 5, max: 300 }),
    autoSpins: boundedInteger(env.AUTO_SPINS, DEFAULTS.autoSpins, { min: 0, max: 100 }),
    autoHistory: parseBooleanOption(env.AUTO_HISTORY, DEFAULTS.autoHistory),
    spinDelayMs: boundedInteger(env.SPIN_DELAY_MS, DEFAULTS.spinDelayMs, { min: 800, max: 30000 })
  };
}

export function normalizeAutoInteractOptions(options = {}, env = process.env) {
  const values = {
    WAIT_SECONDS: options.waitSeconds ?? env.WAIT_SECONDS,
    AUTO_SPINS: options.autoSpins ?? env.AUTO_SPINS,
    AUTO_HISTORY: options.autoHistory ?? env.AUTO_HISTORY,
    SPIN_DELAY_MS: options.spinDelayMs ?? env.SPIN_DELAY_MS
  };
  return normalizeCollectOptions(values);
}
