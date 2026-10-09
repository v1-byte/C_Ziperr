import { extractReferencedUrls, looksLikeStaticAsset } from "./urls.js";
import { isExcluded } from "../classify/resource.js";

const HARD_MAX_CANDIDATES = 1000;

/**
 * Discover public static resources missed by browser request events.
 * API/realtime endpoints, excluded trackers, and non-HTTP schemes are omitted.
 */
export function extractProactiveCandidates(sources = [], runtimeUrls = [], limit = 500) {
  const max = Math.min(HARD_MAX_CANDIDATES, Math.max(0, Number(limit) || 0));
  const candidates = new Set();
  const add = (raw, baseUrl) => {
    if (!raw || candidates.size >= max) return;
    try {
      const url = new URL(String(raw).replace(/&amp;/gi, "&").trim(), baseUrl);
      if (!/^https?:$/.test(url.protocol)) return;
      url.hash = "";
      const value = url.href;
      if (!looksLikeStaticAsset(value) || isExcluded(value)) return;
      candidates.add(value);
    } catch (_) {}
  };

  for (const source of Array.isArray(sources) ? sources : []) {
    if (candidates.size >= max) break;
    if (source && typeof source.text === "string") {
      for (const url of extractReferencedUrls(source.text, source.baseUrl)) {
        add(url, source.baseUrl);
        if (candidates.size >= max) break;
      }
    }
  }
  for (const url of Array.isArray(runtimeUrls) ? runtimeUrls : []) {
    add(url);
    if (candidates.size >= max) break;
  }
  return [...candidates];
}

export default extractProactiveCandidates;
