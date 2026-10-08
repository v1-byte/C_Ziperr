#!/usr/bin/env python3
"""Capture public browser-delivered assets into a reproducible offline package.

Safety boundaries:
- Uses a fresh browser context; no cookies, localStorage, or auth headers are loaded.
- Downloads only successful public responses observed by the browser.
- Does not bypass CAPTCHA, DRM, login, signed URL expiry, or access controls.
- Writes a manifest with captured, failed, blocked, and auth-required observations.

Install:
  python -m pip install playwright
  python -m playwright install chromium

Run:
  python scripts/public_asset_capture.py --url https://example.com/game --output capture
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import mimetypes
import re
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

STATIC_TYPES = {
    "text/css", "text/javascript", "application/javascript", "application/x-javascript",
    "application/json", "application/wasm", "application/xml", "image/png", "image/jpeg",
    "image/gif", "image/webp", "image/avif", "image/svg+xml", "image/x-icon",
    "audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "video/mp4", "video/webm",
    "font/woff", "font/woff2", "font/ttf", "font/otf", "application/octet-stream",
}
STATIC_EXT = re.compile(r"\.(?:js|mjs|css|json|map|wasm|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|mp3|ogg|wav|m4a|mp4|webm|atlas|bin|data)(?:$|[?#])", re.I)
SENSITIVE_QUERY = re.compile(r"(^|&)(token|access_token|authorization|auth|key|secret|sig|signature|jwt|session|__hv|__sv)=", re.I)


def redacted_url(raw: str) -> str:
    """Keep URL identity while removing likely credential-bearing query values."""
    parsed = urlparse(raw)
    if not parsed.query:
        return raw
    parts = []
    for item in parsed.query.split("&"):
        key = item.split("=", 1)[0]
        if SENSITIVE_QUERY.search(key + "="):
            parts.append(key + "=<redacted>")
        else:
            parts.append(item)
    query = "&".join(parts)
    return parsed._replace(query=query).geturl()


def safe_name(raw_url: str, content_type: str, index: int) -> str:
    parsed = urlparse(raw_url)
    name = Path(parsed.path).name or "asset"
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)[:100].strip("._") or "asset"
    if "." not in name:
        ext = mimetypes.guess_extension(content_type.split(";", 1)[0].strip()) or ".bin"
        name += ext
    digest = hashlib.sha256(raw_url.encode()).hexdigest()[:12]
    return f"{index:05d}-{digest}-{name}"


def classify(content_type: str, url: str) -> str:
    ctype = content_type.split(";", 1)[0].lower().strip()
    path = urlparse(url).path.lower()
    if ctype.startswith("image/") or re.search(r"\.(png|jpe?g|gif|webp|avif|svg|ico)$", path):
        return "image/symbol"
    if ctype.startswith("audio/") or ctype.startswith("video/"):
        return "media"
    if "font" in ctype or re.search(r"\.(woff2?|ttf|otf)$", path):
        return "font"
    if "javascript" in ctype or path.endswith((".js", ".mjs")):
        return "script"
    if "css" in ctype or path.endswith(".css"):
        return "stylesheet"
    if "json" in ctype or path.endswith((".json", ".map", ".atlas")):
        return "data/manifest"
    return "other-static"


async def main() -> int:
    ap = argparse.ArgumentParser(description="Capture publicly delivered CDN assets from a fresh browser session.")
    ap.add_argument("--url", required=True, help="Public http/https URL you are authorized to inspect")
    ap.add_argument("--output", default="public-asset-capture", help="Output directory")
    ap.add_argument("--wait", type=float, default=20, help="Seconds to observe runtime requests")
    ap.add_argument("--max-bytes", type=int, default=64 * 1024 * 1024, help="Skip individual responses larger than this")
    args = ap.parse_args()
    if urlparse(args.url).scheme not in {"http", "https"}:
        ap.error("--url harus memakai http atau https")

    out = Path(args.output)
    assets = out / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    manifest = {
        "version": 1,
        "source": redacted_url(args.url),
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "policy": "public-browser-responses-only",
        "captured": [], "failed": [], "blocked_or_auth_required": [],
    }
    seen: set[str] = set()
    counter = 0

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        # Deliberately no storage_state, cookies, extra auth headers, or bypass flags.
        context = await browser.new_context(ignore_https_errors=False)
        page = await context.new_page()

        async def on_response(response):
            nonlocal counter
            url = response.url
            if url in seen or url.startswith(("data:", "blob:", "about:")):
                return
            seen.add(url)
            ctype = (response.headers.get("content-type") or "").lower()
            if not (ctype.split(";", 1)[0] in STATIC_TYPES or STATIC_EXT.search(url)):
                return
            entry = {"url": redacted_url(url), "status": response.status, "content_type": ctype}
            if response.status in {401, 403, 407, 451}:
                entry["status_class"] = "AUTH_REQUIRED_OR_BLOCKED"
                manifest["blocked_or_auth_required"].append(entry)
                return
            if not 200 <= response.status < 300:
                entry["status_class"] = "FAILED_HTTP"
                manifest["failed"].append(entry)
                return
            try:
                body = await response.body()
                if not body:
                    entry["status_class"] = "EMPTY"
                    manifest["failed"].append(entry)
                    return
                if len(body) > args.max_bytes:
                    entry["status_class"] = "TOO_LARGE"
                    entry["bytes"] = len(body)
                    manifest["failed"].append(entry)
                    return
                counter += 1
                filename = safe_name(url, ctype, counter)
                target = assets / filename
                target.write_bytes(body)
                entry.update({"file": str(target.relative_to(out)), "bytes": len(body), "kind": classify(ctype, url), "sha256": hashlib.sha256(body).hexdigest()})
                manifest["captured"].append(entry)
                print(f"CAPTURED {entry['kind']:16} {len(body):>9} {entry['file']}")
            except Exception as exc:
                entry["error"] = str(exc)[:300]
                manifest["failed"].append(entry)

        page.on("response", on_response)
        try:
            await page.goto(args.url, wait_until="domcontentloaded", timeout=45_000)
        except PlaywrightTimeoutError:
            manifest["navigation_warning"] = "domcontentloaded timeout; runtime observation continued"
        except Exception as exc:
            manifest["navigation_error"] = str(exc)[:300]
        await page.wait_for_timeout(max(0, int(args.wait * 1000)))
        await browser.close()

    manifest["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    manifest["summary"] = {k: len(manifest[k]) for k in ("captured", "failed", "blocked_or_auth_required")}
    (out / "public-assets-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "README.txt").write_text(
        "Public CDN capture\n\n"
        "Only successful public browser responses were saved. Entries marked FAILED or "
        "AUTH_REQUIRED_OR_BLOCKED were not bypassed. Review the manifest before hosting.\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest["summary"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
