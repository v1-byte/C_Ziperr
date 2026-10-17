import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canHandle,
  cleanUrl,
  stripTokensFromText,
  neutralizeProtections,
  rewriteAssetPaths,
  rewriteHtml,
  EajzzxhroPlugin,
} from "../src/plugins/eajzzxhro.js";
import { findPlugin, cleanCollectUrl, rewriteWithPlugin } from "../src/plugins/index.js";

describe("eajzzxhro plugin", () => {
  it("detects eajzzxhro /74 urls", () => {
    assert.equal(canHandle("https://m.eajzzxhro.com/74/index.html"), true);
    assert.equal(canHandle("https://example.com/game"), false);
  });

  it("strips ot/__hv/__sv/btt/or tokens from URL", () => {
    const dirty =
      "https://m.eajzzxhro.com/74/index.html?ot=ca709abcdef012345678901234567890&__hv=abc&__sv=def&btt=2&or=x&l=en";
    const cleaned = cleanUrl(dirty);
    assert.equal(cleaned.includes("ot="), false);
    assert.equal(cleaned.includes("__hv="), false);
    assert.equal(cleaned.includes("__sv="), false);
    assert.equal(cleaned.includes("btt="), false);
    assert.equal(cleaned.includes("or="), false);
    assert.equal(cleaned.includes("l=en"), true);
  });

  it("strips tokens from HTML text", () => {
    const html =
      '<script src="/74/assets/app.js?ot=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&__hv=1&__sv=2"></script>';
    const { text, stripped } = stripTokensFromText(html);
    assert.ok(stripped >= 1);
    assert.equal(text.includes("ot="), false);
  });

  it("neutralizes frame-buster and debugger", () => {
    const src = "if (top != self) top.location=self.location; debugger; console.clear();";
    const { html, fixes } = neutralizeProtections(src);
    assert.ok(fixes.includes("frame-buster") || fixes.includes("anti-debug"));
    assert.equal(html.includes("debugger;"), false);
  });

  it("rewrites absolute asset hosts to relative", () => {
    const src = 'src="https://m.eajzzxhro.com/74/static/74.loader.js"';
    const { html, rewrites } = rewriteAssetPaths(src);
    assert.ok(rewrites >= 1);
    assert.ok(html.includes("./assets/static/"));
  });

  it("full rewriteHtml pipeline returns report", () => {
    const src = `
      <html><body>
      <script>if (top != self) top.location=self.location;</script>
      <img src="https://m.eajzzxhro.com/74/assets/symbols.png?ot=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa">
      </body></html>`;
    const { html, report } = rewriteHtml(src);
    assert.equal(report.site, "eajzzxhro");
    assert.ok(report.tokensStripped >= 1 || report.pathRewrites >= 1);
    assert.ok(html.includes("/*C_ZIPERR_EAJZZ_HOOKS*/") || html.includes("frame-buster"));
  });

  it("registry finds plugin and cleans URL", () => {
    const url = "https://m.eajzzxhro.com/74/?ot=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    assert.equal(findPlugin(url)?.id, "eajzzxhro");
    assert.equal(cleanCollectUrl(url).includes("ot="), false);
    const { report } = rewriteWithPlugin(url, "<html></html>");
    assert.equal(report.site, "eajzzxhro");
  });

  it("exports plugin object shape", () => {
    assert.equal(EajzzxhroPlugin.DOMAIN, "eajzzxhro.com");
    assert.ok(Array.isArray(EajzzxhroPlugin.STRIP_PARAMS));
    assert.ok(EajzzxhroPlugin.getAssetPatterns().length >= 1);
  });
});
