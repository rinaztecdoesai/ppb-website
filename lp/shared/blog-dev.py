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

# repo root = two levels up from lp/shared/
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BUILD = os.path.join(ROOT, "lp", "shared", "blog-build.py")


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
    args = parser.parse_args()

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
