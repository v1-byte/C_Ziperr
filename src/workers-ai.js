const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const REQUEST_TIMEOUT_MS = 90000;

function extractText(result) {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  if (typeof result.response === "string") return result.response;
  if (typeof result.output_text === "string") return result.output_text;
  if (typeof result.result?.response === "string") return result.result.response;
  if (typeof result.result === "string") return result.result;
  const choice = result.choices?.[0];
  if (typeof choice?.message?.content === "string") return choice.message.content;
  return "";
}

export async function workersAiChat(env, messages, options = {}) {
  if (!env?.AI || typeof env.AI.run !== "function") {
    return { ok: false, status: 503, error: "CLOUDFLARE_WORKERS_AI_NOT_CONFIGURED: binding AI belum terhubung." };
  }
  const model = String(options.model || env.WORKERS_AI_MODEL || DEFAULT_MODEL);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const result = await Promise.race([
      env.AI.run(model, {
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: Math.min(Number(options.maxTokens || 1600), 2400)
      }),
      new Promise((_, reject) => {
        const error = new Error("Cloudflare Workers AI timeout.");
        error.name = "AbortError";
        controller.signal.addEventListener("abort", () => reject(error), { once: true });
      })
    ]);
    const text = extractText(result);
    if (!text) return { ok: false, status: 502, error: "Cloudflare Workers AI mengembalikan respons kosong." };
    return { ok: true, model, text, response: result };
  } catch (error) {
    return {
      ok: false,
      status: error?.name === "AbortError" ? 504 : 502,
      error: error?.name === "AbortError" ? "Cloudflare Workers AI timeout." : String(error?.message || error)
    };
  } finally {
    clearTimeout(timer);
  }
}

export function workersAiHealth(env) {
  return {
    configured: Boolean(env?.AI && typeof env.AI.run === "function"),
    model: String(env?.WORKERS_AI_MODEL || DEFAULT_MODEL),
    provider: "cloudflare-workers-ai"
  };
}
