#!/usr/bin/env python3
"""
Prime Property Buyers — single-source site chrome propagation.

WHY: the content pages are static HTML (no build step), so the <nav> and
<footer> would otherwise be copy-pasted into every file. This script keeps
ONE canonical copy here and writes it into each page's STATIC HTML — so the
links stay in the markup (SEO/LLM-friendly, no JS flash) AND a change is a
single edit.

USAGE:  edit NAV / FOOTER / PAGES below, then run:
            python3 lp/shared/build.py
        then re-preview. (Scope = the content pages; the landing pages use a
        different nav implementation and are intentionally not touched here.)
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # project root

# --- registry: page file -> its own path (for the active nav highlight) ---
PAGES = {
    "important-advice/index.html": "/important-advice/",
    "faqs/index.html":             "/faqs/",
    "why-us/index.html":           "/why-us/",
    "contact/index.html":          "/contact/",
}

# --- canonical NAV (edit links here once). %X% = active-state placeholders ---
NAV = """<header class="site-nav">
  <div class="nav-inner">
    <a class="nav-brand" href="/lp/pp-cash-offer/" aria-label="Prime Property Buyers — home">
      <img src="/lp/shared/assets/logo.png?v=2" alt="Prime Property Buyers" width="130" height="42">
    </a>
    <button class="nav-toggle" aria-label="Open menu" aria-expanded="false"><svg viewBox="0 0 24 24"><use href="#i-menu"></use></svg></button>
    <ul class="nav-menu">
      <li><a href="/lp/pp-cash-offer/"%HOME%>Home</a></li>
      <li><a href="/important-advice/"%/important-advice/%>Important Advice</a></li>
      <li><a href="/why-us/"%/why-us/%>Why Us</a></li>
      <li><a href="/faqs/"%/faqs/%>FAQs</a></li>
      <li><a href="/contact/"%/contact/%>Contact</a></li>
    </ul>
    <div class="nav-actions">
      <a class="nav-phone" href="tel:08000122239"><svg class="icon"><use href="#i-phone"></use></svg><span class="num">0800 0122 239<small>7 days a week · 8am–8pm</small></span></a>
    </div>
  </div>
</header>"""

# --- canonical FOOTER (edit links here once) ---
FOOTER = """<footer class="site-footer">
  <div class="footer-grid">
    <div class="footer-col">
      <img src="/lp/shared/assets/logo.png?v=2" alt="Prime Property Buyers" class="footer-logo">
      <p class="footer-tagline">Direct cash buyer · Thousands of properties bought · since 1993</p>
      <a class="footer-phone" href="tel:08000122239"><svg class="icon"><use href="#i-phone"></use></svg> 0800 0122 239</a>
    </div>
    <div class="footer-col">
      <h4>Company</h4>
      <ul>
        <li><a href="/lp/pp-cash-offer/">Home</a></li>
        <li><a href="/important-advice/">Important Advice</a></li>
        <li><a href="/why-us/">Why Us</a></li>
        <li><a href="/faqs/">FAQs</a></li>
        <li><a href="/contact/">Contact</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Our Services</h4>
      <ul>
        <li><a href="/selling-inherited-property/">Inherited property</a></li>
        <li><a href="/lp/pp-cash-offer/">Selling due to divorce</a></li>
        <li><a href="/lp/pp-cash-offer/">Broken property chain</a></li>
        <li><a href="/lp/pp-cash-offer/">Selling due to ill health</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Useful Information</h4>
      <ul>
        <li><a href="/faqs/">FAQs</a></li>
        <li><a href="https://primepropertybuyers.uk/terms-conditions/">Terms &amp; Conditions</a></li>
        <li><a href="https://primepropertybuyers.uk/privacy-policy/">Privacy Policy</a></li>
        <li><a href="/contact/">Contact Us</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&copy; 2026 Primepropertybuyers.uk · Marketing name for UK National Properties Ltd · Registered in England No. 12973116</p>
    <nav aria-label="Legal"><a href="https://primepropertybuyers.uk/terms-conditions/">Terms</a><a href="https://primepropertybuyers.uk/privacy-policy/">Privacy</a></nav>
  </div>
</footer>"""

ACTIVE_KEYS = ["%HOME%", "%/important-advice/%", "%/why-us/%", "%/faqs/%", "%/contact/%"]


def render_nav(active_path):
    nav = NAV
    for key in ACTIVE_KEYS:
        on = key.strip("%") == active_path
        nav = nav.replace(key, ' aria-current="page"' if on else "")
    return nav


# --- consistency check: catches drift as the site grows ----------------------
# Every page must carry the same tracking IDs; each page-type must load its
# shared files. Run:  python3 lp/shared/build.py check
TRACK_IDS = ["GTM-5D9NNXQ", "G-MHJNE8WJ6T", "AW-789719856",
             "c64724af-0832-4c2f-8549-e9d1bc265708", "hjid:6590098"]
CONTENT_FILES = ["pp-pages.css", "pp-pages.js", "widgets.js", "widgets.css", "script.js"]
LANDING_FILES = ["shared/styles.css", "shared/script.js"]
CONTENT_PAGES = list(PAGES.keys())
LANDING_PAGES = ["lp/pp-cash-offer/index.html", "selling-inherited-property/index.html",
                 "lp/modern-method-of-auction/index.html"]


def check():
    ok = True
    for page in CONTENT_PAGES + LANDING_PAGES:
        fp = os.path.join(ROOT, page)
        if not os.path.exists(fp):
            print(f"  MISSING FILE: {page}"); ok = False; continue
        s = open(fp, encoding="utf-8").read()
        need = list(TRACK_IDS) + (CONTENT_FILES if page in CONTENT_PAGES else LANDING_FILES)
        miss = [t for t in need if t not in s]
        print(f"  {'OK  ' if not miss else 'DRIFT'} {page}" + (f"  missing: {miss}" if miss else ""))
        if miss:
            ok = False
    print("All consistent." if ok else "*** Drift found — fix the pages above. ***")
    return ok


def main():
    for page, active in PAGES.items():
        fp = os.path.join(ROOT, page)
        if not os.path.exists(fp):
            print(f"  skip (missing): {page}")
            continue
        s = open(fp, encoding="utf-8").read()
        nav = render_nav(active)
        out, n1 = re.subn(r"<header class=\"site-nav\">.*?</header>", lambda m: nav, s, count=1, flags=re.S)
        out, n2 = re.subn(r"<footer class=\"site-footer\">.*?</footer>", lambda m: FOOTER, out, count=1, flags=re.S)
        if out != s:
            open(fp, "w", encoding="utf-8").write(out)
        print(f"  {page:34s} nav={n1} footer={n2}")
    print("Done. Re-preview the pages.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        sys.exit(0 if check() else 1)
    main()
