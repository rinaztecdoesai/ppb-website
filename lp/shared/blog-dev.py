#!/usr/bin/env python3
"""Local dev server for the static site + auto-rebuilding blog.

Why this exists: the /blog pages are STATIC HTML generated from the Kereeb
Content API by blog-build.py. Unlike a Next.js app (a server that fetches the
API on every request), a static site only changes when it's regenerated. In
production that regeneration runs on deploy; locally it means re-running the
build by hand after every publish — annoying.

This script removes the manual step for LOCAL development only. It:
  1. Serves the repo on http://localhost:PORT  (like `python3 -m http.server`)
  2. Every INTERVAL seconds, re-runs blog-build.py in the background so newly
     published Kereeb articles appear on refresh — no command to type.

Usage (from the repo root):
    python3 lp/shared/blog-dev.py                 # port 8770, rebuild every 15s
    python3 lp/shared/blog-dev.py --port 9000 --interval 10

Then open http://localhost:8770/blog/  — publish in Kereeb, wait a few seconds,
refresh. Stop with Ctrl-C.

This is a dev convenience only. It does NOT change how production works and it
keeps the API key build-time (never shipped to the browser).

WARNING: NEVER point this at the PRODUCTION Content API. It re-runs blog-build.py
every INTERVAL seconds (~15s), and each rebuild GETs the Content API. Pointed at
prod that is thousands of authenticated reads per day that drain the shared read
quota and can 429 the real deploy pipeline. This watcher refuses to poll a
non-local KEREEB_API_URL unless you pass --allow-remote-api (don't, in normal
dev). See BLOG-DEPLOYMENT.md.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import subprocess
import sys
import threading
import time
import urllib.parse

# repo root = two levels up from lp/shared/
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BUILD = os.path.join(ROOT, "lp", "shared", "blog-build.py")

# Hosts the poller is allowed to hammer. Anything else is treated as production.
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", ""}


def _kereeb_api_host() -> str:
    """Resolve the configured KEREEB_API_URL host from the env or .env.local.

    blog-dev.py doesn't otherwise read .env.local (blog-build.py does), so we do
    a minimal parse here purely to guard against pointing the 15s poll loop at
    production.
    """
    api_url = os.environ.get("KEREEB_API_URL", "").strip()
    if not api_url:
        env_path = os.path.join(ROOT, ".env.local")
        if os.path.exists(env_path):
            with open(env_path, encoding="utf-8") as fh:
                for raw in fh:
                    line = raw.strip()
                    if line.startswith("KEREEB_API_URL") and "=" in line:
                        api_url = line.partition("=")[2].strip().strip('"').strip("'")
                        break
    if not api_url:
        return ""
    return (urllib.parse.urlsplit(api_url).hostname or "").lower()


def guard_against_prod_api(allow_remote: bool) -> None:
    """Abort loudly if the watcher would poll a non-local (production) API.

    The 15s rebuild loop makes thousands of Content API reads/day; against prod
    that drains the shared read quota and can 429 the real deploy. Local hosts
    are fine; anything else needs an explicit, deliberate --allow-remote-api.
    """
    host = _kereeb_api_host()
    if host in _LOCAL_HOSTS or allow_remote:
        if allow_remote and host not in _LOCAL_HOSTS:
            print(f"[blog-dev] WARNING --allow-remote-api set: polling REMOTE API '{host}'. "
                  "This spends real read quota every ~15s — stop it when done.")
        return
    sys.stderr.write(
        "\n[blog-dev] REFUSING TO START — KEREEB_API_URL points at a non-local host:\n"
        f"    {host}\n\n"
        "blog-dev.py polls the Content API every ~15s. Against PRODUCTION that is\n"
        "thousands of authenticated reads/day draining the shared read quota, which\n"
        "can 429 and abort the real blog deploy pipeline.\n\n"
        "Do one of:\n"
        "  • point KEREEB_API_URL at a local Kereeb instance (localhost) for dev, or\n"
        "  • just run `python3 lp/shared/blog-build.py` once by hand, or\n"
        "  • (only if you REALLY mean it) re-run with --allow-remote-api.\n\n"
    )
    raise SystemExit(2)


def rebuild_loop(interval: int, stop: threading.Event) -> None:
    """Re-run blog-build.py every `interval` seconds until told to stop.

    blog-build.py is idempotent (only rewrites files whose content changed), so
    a tight loop is cheap and safe. Output is summarised so the terminal stays
    readable; the full generator output is shown only when it fails.
    """
    last_signature = None
    while not stop.is_set():
        try:
            result = subprocess.run(
                [sys.executable, BUILD],
                cwd=ROOT,
                capture_output=True,
                text=True,
                timeout=120,
            )
            out = (result.stdout or "").strip()
            if result.returncode != 0:
                sys.stdout.write(
                    "\n[blog-dev] rebuild FAILED — keeping the last good build:\n"
                    + (result.stderr or out or "unknown error") + "\n"
                )
                sys.stdout.flush()
            else:
                # Only log when the post count line changes, to avoid spam.
                signature = next(
                    (ln for ln in out.splitlines() if "post summary" in ln), out
                )
                if signature != last_signature:
                    sys.stdout.write(f"\n[blog-dev] {signature}\n")
                    sys.stdout.flush()
                    last_signature = signature
        except Exception as exc:  # never let the watcher die
            sys.stdout.write(f"\n[blog-dev] watcher error: {exc}\n")
            sys.stdout.flush()
        stop.wait(interval)


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the site + auto-rebuild the blog.")
    parser.add_argument("--port", type=int, default=8770)
    parser.add_argument("--interval", type=int, default=15,
                        help="seconds between automatic blog rebuilds (default 15)")
    parser.add_argument("--allow-remote-api", action="store_true",
                        help="DANGER: permit polling a non-local (production) "
                             "KEREEB_API_URL. Drains the shared read quota; avoid.")
    args = parser.parse_args()

    # Never let the 15s poll loop hammer the production Content API.
    guard_against_prod_api(args.allow_remote_api)

    # One rebuild up front so the site is current the moment the server is up.
    print("[blog-dev] initial blog build…")
    subprocess.run([sys.executable, BUILD], cwd=ROOT)

    stop = threading.Event()
    watcher = threading.Thread(target=rebuild_loop, args=(args.interval, stop), daemon=True)
    watcher.start()

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    httpd = http.server.ThreadingHTTPServer(("0.0.0.0", args.port), handler)

    print(f"[blog-dev] serving {ROOT}")
    print(f"[blog-dev] → http://localhost:{args.port}/blog/")
    print(f"[blog-dev] auto-rebuilding every {args.interval}s — publish in Kereeb, then refresh.")
    print("[blog-dev] Ctrl-C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[blog-dev] stopping…")
    finally:
        stop.set()
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
