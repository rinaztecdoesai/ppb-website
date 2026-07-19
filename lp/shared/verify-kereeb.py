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
import random
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Transient-failure policy (mirrors lp/shared/kereeb.py). A shared read-quota
# 429 is a soft, temporary limit — it must never abort the deploy. We retry a
# few times, then SOFT-SKIP (exit 0) so the build proceeds; blog-build.py then
# preserves the last-good pages. Real misconfig (auth/DNS) still hard-fails.
MAX_ATTEMPTS = 4
BACKOFF_BASE = 0.5  # seconds
BACKOFF_CAP = 8.0  # seconds
RETRY_STATUSES = {429, 500, 502, 503, 504}


def retry_after_seconds(exc: urllib.error.HTTPError):
    """Parse a numeric Retry-After (delta-seconds) header, capped, else None."""
    raw = exc.headers.get("Retry-After") if exc.headers else None
    if not raw:
        return None
    try:
        secs = float(str(raw).strip())
    except (TypeError, ValueError):
        return None
    return min(secs, BACKOFF_CAP) if secs >= 0 else None


def backoff_delay(attempt: int, retry_after) -> float:
    """Delay before the next attempt: honour Retry-After, else exp backoff+jitter."""
    if retry_after is not None:
        return retry_after
    delay = min(BACKOFF_BASE * (2 ** attempt), BACKOFF_CAP)
    return delay + random.uniform(0, delay / 2)


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
    status = None
    payload = None
    for attempt in range(MAX_ATTEMPTS):
        req = urllib.request.Request(endpoint, headers={"x-kereeb-key": api_key})
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                status = resp.getcode()
                payload = json.loads(resp.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as exc:
            # Transient (429 / 5xx): back off and retry, then soft-skip.
            if exc.code in RETRY_STATUSES:
                if attempt < MAX_ATTEMPTS - 1:
                    delay = backoff_delay(attempt, retry_after_seconds(exc))
                    print(f"  … HTTP {exc.code} {exc.reason} (transient) — retrying "
                          f"in {delay:.1f}s [{attempt + 2}/{MAX_ATTEMPTS}]")
                    time.sleep(delay)
                    continue
                print(f"⚠ HTTP {exc.code} {exc.reason} after {MAX_ATTEMPTS} attempts — "
                      "the Content API is rate-limited/unavailable right now.")
                print("  SOFT-SKIP: proceeding with the build so the deploy is not "
                      "aborted; blog-build.py preserves the last-good pages.")
                return 0
            # Non-transient HTTP error (401/403/404/4xx) = real misconfig.
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
