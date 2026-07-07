#!/usr/bin/env python3
"""
Server-side (build-time) client for PPB's Kereeb Content API.

This is the Python analogue of the reference `src/lib/kereeb.ts` used on the
sister Next.js sites, adapted to this repo's static-HTML + Python build system.
It is imported by lp/shared/blog-build.py to fetch published posts and render
static HTML. The API key is used ONLY here at build time and never reaches the
browser.

Content API contract:
  GET /api/content/posts?limit=<=50&cursor=<cursor>
      -> { "posts": [PostSummary, ...], "nextCursor": str | None }
  GET /api/content/posts/<slug>
      -> PostDetail  (summary fields + "html" + "meta")
  Auth header: x-kereeb-key: <key>

Every call fails CLOSED and GRACEFULLY: any non-2xx / network / parse error
returns [] (lists) or None (single post), so a build never crashes on a flaky
API — it just produces the empty state, which ISR-style regeneration heals on
the next run.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional

PAGE_LIMIT = 50  # API max per page
_TIMEOUT = 20


def _config() -> tuple[str, str]:
    return (
        os.environ.get("KEREEB_API_URL", "").rstrip("/"),
        os.environ.get("KEREEB_API_KEY", "").strip(),
    )


def is_kereeb_configured() -> bool:
    """True only when both the API URL and key are present."""
    api_url, api_key = _config()
    return bool(api_url and api_key)


def _api_origin() -> str:
    """Scheme://host of the API, used to absolutize relative image URLs."""
    api_url, _ = _config()
    if not api_url:
        return ""
    parts = urllib.parse.urlsplit(api_url)
    return f"{parts.scheme}://{parts.netloc}"


def absolutize_image_url(src: Optional[str]) -> Optional[str]:
    """Relative Kereeb image path -> absolute URL against the API origin.

    Handles hero images and inline `<img src="/api/images/...">`. Already-
    absolute URLs (http/https/protocol-relative/data:) pass through untouched.
    """
    if not src:
        return src
    s = src.strip()
    if s.startswith(("http://", "https://", "//", "data:")):
        return s
    origin = _api_origin()
    if not origin:
        return s
    if not s.startswith("/"):
        s = "/" + s
    return origin + s


def _get_json(path: str) -> Optional[Any]:
    """GET an API path with auth; return parsed JSON or None on any failure."""
    api_url, api_key = _config()
    if not api_url or not api_key:
        return None
    url = f"{api_url}{path}"
    req = urllib.request.Request(url, headers={"x-kereeb-key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            if resp.getcode() < 200 or resp.getcode() >= 300:
                return None
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError,
            json.JSONDecodeError, ValueError):
        return None


def is_content_api_reachable() -> bool:
    """True when the posts endpoint answers with the expected JSON shape.

    This lets the static generator distinguish "zero published posts" from
    "API failed", so it can safely remove stale generated article pages only
    after a successful API response.
    """
    data = _get_json("/api/content/posts?limit=1")
    return isinstance(data, dict) and isinstance(data.get("posts"), list)


def list_posts(limit: int = PAGE_LIMIT, cursor: Optional[str] = None) -> dict[str, Any]:
    """One page of post summaries. Returns {"posts": [...], "nextCursor": ...}.

    Always returns a well-formed dict even on failure (posts=[], nextCursor=None).
    """
    limit = max(1, min(limit, PAGE_LIMIT))
    query = {"limit": str(limit)}
    if cursor:
        query["cursor"] = cursor
    data = _get_json("/api/content/posts?" + urllib.parse.urlencode(query))
    if not isinstance(data, dict):
        return {"posts": [], "nextCursor": None}
    posts = data.get("posts")
    return {
        "posts": posts if isinstance(posts, list) else [],
        "nextCursor": data.get("nextCursor"),
    }


def list_all_posts() -> list[dict[str, Any]]:
    """Every published post summary, following the cursor. [] on any failure."""
    if not is_kereeb_configured():
        return []
    out: list[dict[str, Any]] = []
    cursor: Optional[str] = None
    seen_cursors: set[str] = set()
    while True:
        page = list_posts(PAGE_LIMIT, cursor)
        out.extend(page["posts"])
        nxt = page["nextCursor"]
        if not nxt or nxt in seen_cursors:
            break
        seen_cursors.add(nxt)
        cursor = nxt
    return out


def get_post(slug: str) -> Optional[dict[str, Any]]:
    """Full post detail for a slug, or None if missing/unreachable."""
    if not slug or not is_kereeb_configured():
        return None
    safe = urllib.parse.quote(slug, safe="")
    data = _get_json(f"/api/content/posts/{safe}")
    if not isinstance(data, dict):
        return None
    return data
