#!/usr/bin/env python3
"""
Zero-dependency connection check for PPB's Kereeb Content API.

WHY: before generating the blog (lp/shared/blog-build.py) we want a fast,
obvious signal that the credentials in .env.local are correct and the API is
reachable. Stdlib only (urllib) — matches build.py; no npm, no pip.

USAGE:
    python3 lp/shared/verify-kereeb.py

Reads KEREEB_API_URL + KEREEB_API_KEY from .env.local (or the environment).
Exit 0 = connected and posts endpoint answered; non-zero = misconfigured or
unreachable (with a human-readable reason).
"""
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def load_env(path: str) -> None:
    """Minimal .env loader: KEY=VALUE lines, # comments, no interpolation."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key, val = key.strip(), val.strip().strip('"').strip("'")
            # .env.local wins over anything already exported, so the file is the
            # single source of truth for local runs.
            os.environ[key] = val


def main() -> int:
    load_env(os.path.join(ROOT, ".env.local"))
    api_url = os.environ.get("KEREEB_API_URL", "").rstrip("/")
    api_key = os.environ.get("KEREEB_API_KEY", "").strip()

    if not api_url or not api_key:
        print("✗ Not configured. Set KEREEB_API_URL and KEREEB_API_KEY in .env.local")
        print("  (copy .env.example → .env.local and fill in PPB's Kereeb values).")
        return 2

    endpoint = f"{api_url}/api/content/posts?limit=1"
    print(f"→ GET {endpoint}")
    req = urllib.request.Request(endpoint, headers={"x-kereeb-key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            status = resp.getcode()
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        print(f"✗ HTTP {exc.code} {exc.reason} — check the API key and URL.")
        return 1
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"✗ Could not reach {api_url}: {exc}")
        return 1
    except json.JSONDecodeError:
        print("✗ Connected but the response was not JSON — wrong URL?")
        return 1

    posts = payload.get("posts", []) if isinstance(payload, dict) else []
    print(f"✓ Connected (HTTP {status}). Content API reachable.")
    print(f"  posts returned in probe: {len(posts)}  |  nextCursor: {payload.get('nextCursor')!r}")
    if not posts:
        print("  NOTE: no published posts yet — the /blog index will render its empty state.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
