/**
 * Site plugin for m.eajzzxhro.com /74 (and variants).
 * Strips short-lived DRM/session tokens, rewrites asset paths,
 * neutralizes frame-busters / anti-debug, and prepares offline hooks.
 */

export const EAJZZXHRO_DOMAIN = "eajzzxhro.com";
export const PATH_PREFIX = "/74/";
export const STRIP_PARAMS = Object.freeze(["ot", "__hv", "__sv", "btt", "or"]);

const TOKEN_QUERY_RE =
  /([?&])(?:ot=[a-f0-9]{16,64}|__hv=[^&]+|__sv=[^&]+|btt=\d+|or=[^&]+)(&)?/gi;

/**
 * @param {string} url
 * @returns {boolean}
 */
export function canHandle(url) {
  const s = String(url || "");
  return s.includes(EAJZZXHRO_DOMAIN) && (s.includes("/74/") || s.includes("/74a/") || s.includes("/74b/"));
}

/**
 * Remove one-time / anti-tamper query params from a URL string.
 * @param {string} url
 * @returns {string}
 */
export function cleanUrl(url) {
  try {
    const u = new URL(url, "https://local.invalid/");
    for (const key of STRIP_PARAMS) u.searchParams.delete(key);
    // Preserve relative form when input was relative
    if (!/^https?:\/\//i.test(url) && u.origin === "https://local.invalid") {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    return u.toString();
  } catch {
    return String(url || "").replace(TOKEN_QUERY_RE, (m, sep, next) => (next ? sep : ""));
  }
}

/**
 * Strip tokens from free-form text (HTML / JS / JSON).
 * @param {string} text
 * @returns {{ text: string, stripped: number }}
 */
export function stripTokensFromText(text) {
  let stripped = 0;
  const out = String(text || "").replace(
    /([?&]|[?&]amp;)(?:ot=[a-f0-9]{16,64}|__hv=[^&"'<>\s]+|__sv=[^&"'<>\s]+|btt=\d+|or=[^&"'<>\s]+)/gi,
    () => {
      stripped += 1;
      return "";
    }
  );
  // Clean empty ? or dangling &
  const cleaned = out
    .replace(/\?&+/g, "?")
    .replace(/[?&]+"/g, '"')
    .replace(/[?&]+'/g, "'")
    .replace(/\?([#"'\s>])/g, "$1");
  return { text: cleaned, stripped };
}

/**
 * Neutralize frame-buster and simple anti-devtools patterns.
 * @param {string} html
 * @returns {{ html: string, fixes: string[] }}
 */
export function neutralizeProtections(html) {
  const fixes = [];
  let out = String(html || "");

  const beforeFrame = out;
  out = out.replace(
    /if\s*\(\s*top\s*!=\s*self\s*\)\s*top\.location\s*=\s*self\.location/gi,
    "if (false) /* frame-buster neutralized */"
  );
  out = out.replace(
    /if\s*\(\s*(?:window\.)?top\s*!==?\s*(?:window\.)?self\s*\)\s*\{?[^}]*top\.location/gi,
    "if (false) { /* frame-buster neutralized */ void 0"
  );
  if (out !== beforeFrame) fixes.push("frame-buster");

  const beforeDbg = out;
  out = out
    .replace(/debugger\s*;/g, "/*debugger neutralized;*/")
    .replace(/console\.clear\s*\(\s*\)/g, "/*console.clear neutralized*/")
    .replace(
      /setInterval\s*\(\s*\(\s*\)\s*=>\s*\{\s*debugger\s*;?\s*\}\s*,\s*\d+\s*\)/g,
      "setInterval(()=>{},9999999)"
    )
    .replace(/__hv\s*&&\s*__hv\.length/g, "false && __hv.length");
  if (out !== beforeDbg) fixes.push("anti-debug");

  return { html: out, fixes };
}

/**
 * Rewrite absolute eajzzxhro asset hosts to relative offline paths.
 * @param {string} html
 * @returns {{ html: string, rewrites: number }}
 */
export function rewriteAssetPaths(html) {
  let rewrites = 0;
  let out = String(html || "");

  const pairs = [
    [/https?:\/\/m\.eajzzxhro\.com\/74\/static\//gi, "./assets/static/"],
    [/\/\/m\.eajzzxhro\.com\/74\/static\//gi, "./assets/static/"],
    [/https?:\/\/m\.eajzzxhro\.com\/static\//gi, "./assets/static/"],
    [/\/\/m\.eajzzxhro\.com\/static\//gi, "./assets/static/"],
    [/https?:\/\/m\.eajzzxhro\.com\/74\/assets\//gi, "./assets/"],
    [/\/74\/assets\//gi, "./assets/"],
    [/https?:\/\/m\.eajzzxhro\.com\/74\//gi, "./"],
  ];

  for (const [re, rep] of pairs) {
    out = out.replace(re, () => {
      rewrites += 1;
      return rep;
    });
  }
  return { html: out, rewrites };
}

/**
 * Inject auto-click Play + offline bootstrap hooks (idempotent markers).
 * @param {string} html
 * @returns {{ html: string, injected: string[] }}
 */
export function injectOfflineHooks(html) {
  const injected = [];
  let out = String(html || "");
  if (out.includes("/*C_ZIPERR_EAJZZ_HOOKS*/")) {
    return { html: out, injected };
  }

  const script = `
<script>
/*C_ZIPERR_EAJZZ_HOOKS*/
(function(){
  try {
    // Auto-click Play when shell is ready
    function tryPlay(){
      var btn = document.querySelector('.btn-play, #start-game, [class*=play], button');
      if (btn) { btn.click(); return true; }
      return false;
    }
    if (!tryPlay()) {
      var n = 0;
      var t = setInterval(function(){ if (tryPlay() || ++n > 40) clearInterval(t); }, 250);
    }
  } catch(e) {}
})();
</script>`;

  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, script + "\n</body>");
  } else {
    out += script;
  }
  injected.push("auto-play");
  return { html: out, injected };
}

/**
 * Full HTML rewrite pipeline for this site.
 * @param {string} html
 * @returns {{ html: string, report: object }}
 */
export function rewriteHtml(html) {
  const token = stripTokensFromText(html);
  const paths = rewriteAssetPaths(token.text);
  const prot = neutralizeProtections(paths.html);
  const hooks = injectOfflineHooks(prot.html);
  return {
    html: hooks.html,
    report: {
      tokensStripped: token.stripped,
      pathRewrites: paths.rewrites,
      protections: prot.fixes,
      hooks: hooks.injected,
      site: "eajzzxhro",
    },
  };
}

/**
 * Asset URL patterns this plugin cares about during collect.
 */
export function getAssetPatterns() {
  return [
    /\/74(?:a|b)?\/assets\/.*\.(js|json|png|jpe?g|gif|webp|mp3|ogg|wav|atlas|skel|wasm|data|br)/i,
    /\/74(?:a|b)?\/static\/.*\.(js|json|png|wasm|data|br|loader\.js)/i,
  ];
}

export const EajzzxhroPlugin = {
  id: "eajzzxhro",
  DOMAIN: EAJZZXHRO_DOMAIN,
  PATH_PREFIX,
  STRIP_PARAMS,
  canHandle,
  cleanUrl,
  stripTokensFromText,
  neutralizeProtections,
  rewriteAssetPaths,
  injectOfflineHooks,
  rewriteHtml,
  getAssetPatterns,
};

export default EajzzxhroPlugin;
