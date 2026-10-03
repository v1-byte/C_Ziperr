const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function retryAfterMs(response, maxDelayMs) {
  const raw = response?.headers?.get?.("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(maxDelayMs, seconds * 1000);
  }
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.min(maxDelayMs, Math.max(0, date - Date.now())) : null;
}

/** Retry only transient transport/server failures. Auth/access failures are returned as-is. */
export async function fetchWithRetry(url, init = {}, options = {}) {
  const attempts = Math.min(4, Math.max(1, Number(options.attempts) || 3));
  const baseDelayMs = Math.min(2000, Math.max(0, Number(options.baseDelayMs ?? 250)));
  const maxDelayMs = Math.min(5000, Math.max(baseDelayMs, Number(options.maxDelayMs ?? 2000)));
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, init);
    } catch (error) {
      lastError = error;
      if (attempt === attempts || init.signal?.aborted) throw error;
      await sleep(Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1))));
      continue;
    }

    if (!RETRYABLE_STATUS.has(response.status) || attempt === attempts) return response;
    try { await response.body?.cancel(); } catch (_) {}
    await sleep(retryAfterMs(response, maxDelayMs) ?? Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1))));
  }
  throw lastError || new Error("fetch failed after retries");
}

export default fetchWithRetry;
