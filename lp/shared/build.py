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
    <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="navMenu"><svg class="nav-ico-open" viewBox="0 0 24 24"><use href="#i-menu"></use></svg><svg class="nav-ico-close" viewBox="0 0 24 24"><use href="#i-x"></use></svg></button>
    <ul class="nav-menu" id="navMenu">
      <li><a href="/lp/pp-cash-offer/"%HOME%>Home</a></li>
      <li><a href="/important-advice/"%/important-advice/%>Important Advice</a></li>
      <li><a href="/why-us/"%/why-us/%>Why Us</a></li>
      <li><a href="/faqs/"%/faqs/%>FAQs</a></li>
      <li><a href="/contact/"%/contact/%>Contact</a></li>
      <li class="nav-menu-cta"><a class="btn btn-primary btn-lg" href="/lp/pp-cash-offer/" data-open-modal="leadModal">Get my cash offer <svg class="icon"><use href="#i-arrow"></use></svg></a></li>
      <li class="nav-menu-cta"><a class="btn btn-wa btn-lg" href="https://wa.me/447719138319" target="_blank" rel="noopener"><svg class="icon" viewBox="0 0 24 24"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.13c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.24-8.23 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg> WhatsApp us</a></li>
      <li class="nav-menu-cta"><a class="btn btn-call btn-lg" href="tel:08000122239"><svg class="icon"><use href="#i-phone"></use></svg> Call 0800 0122 239</a></li>
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
CONTENT_FILES = ["pp-pages.css", "pp-pages.js", "widgets.js", "widgets.css", "script.js", "footer.css"]
LANDING_FILES = ["styles.css", "script.js", "footer.css"]
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
    # NAV — content pages only (landing pages have their own nav implementation)
    for page, active in PAGES.items():
        fp = os.path.join(ROOT, page)
        if not os.path.exists(fp):
            print(f"  skip (missing): {page}"); continue
        s = open(fp, encoding="utf-8").read()
        out, n = re.subn(r"<header class=\"site-nav\">.*?</header>", lambda m: render_nav(active), s, count=1, flags=re.S)
        if out != s:
            open(fp, "w", encoding="utf-8").write(out)
        print(f"  nav    {page:38s} n={n}")
    # FOOTER — EVERY page (content + landing). Matches site-footer OR the old
    # landing brand-bar; never the .chatbot-footer (different class).
    for page in list(PAGES.keys()) + LANDING_PAGES:
        fp = os.path.join(ROOT, page)
        if not os.path.exists(fp):
            print(f"  skip (missing): {page}"); continue
        s = open(fp, encoding="utf-8").read()
        out, n = re.subn(r"<footer class=\"(?:site-footer|brand-bar)\"[^>]*>.*?</footer>", lambda m: FOOTER, s, count=1, flags=re.S)
        if out != s:
            open(fp, "w", encoding="utf-8").write(out)
        print(f"  footer {page:38s} n={n}")
    print("Done. Re-preview the pages.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        sys.exit(0 if check() else 1)
    main()
