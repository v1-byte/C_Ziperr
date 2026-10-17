/**
 * Site plugin registry for collect / rewrite pipeline.
 */
import { EajzzxhroPlugin } from "./eajzzxhro.js";

/** @type {import('./eajzzxhro.js').EajzzxhroPlugin[]} */
export const PLUGINS = [EajzzxhroPlugin];

/**
 * Find the first plugin that can handle a URL.
 * @param {string} url
 */
export function findPlugin(url) {
  for (const plugin of PLUGINS) {
    if (plugin.canHandle?.(url)) return plugin;
  }
  return null;
}

/**
 * Clean URL using matching plugin, or return as-is.
 * @param {string} url
 */
export function cleanCollectUrl(url) {
  const plugin = findPlugin(url);
  return plugin ? plugin.cleanUrl(url) : url;
}

/**
 * Rewrite HTML using matching plugin when available.
 * @param {string} url
 * @param {string} html
 */
export function rewriteWithPlugin(url, html) {
  const plugin = findPlugin(url);
  if (!plugin?.rewriteHtml) {
    return { html, report: { site: null } };
  }
  return plugin.rewriteHtml(html);
}

export { EajzzxhroPlugin };
export default PLUGINS;
