#!/usr/bin/env python3
"""
Prime Property Buyers — single-source site chrome propagation.
Built and maintained by JF Design — https://thejfdesign.co.uk

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

# The shared header goes on EVERY page now (landing + content). Value = the
# active-nav key, or None for pages that aren't in the menu (MMA, inherited).
NAV_PAGES = {
    "index.html":            "HOME",
    "important-advice/index.html":            "/important-advice/",
    "why-us/index.html":                      "/why-us/",
    "faqs/index.html":                        "/faqs/",
    "contact/index.html":                     "/contact/",
    "lp/modern-method-of-auction/index.html": None,
    "selling-inherited-property/index.html":  None,
    "stop-repossession/index.html":           None,
    "selling-house-after-divorce/index.html": None,
    "selling-house-due-illness/index.html":   None,
    "selling-house-pay-debt/index.html":      None,
    "sell-your-house-fast/index.html":        None,
    "sell-former-buy-to-let/index.html":      None,
}

# --- canonical NAV (edit links here once). %X% = active-state placeholders ---
NAV = """<header class="site-nav">
  <div class="nav-inner">
    <a class="nav-brand" href="/" aria-label="Prime Property Buyers — home">
      <img src="/lp/shared/assets/logo.png?v=2" alt="Prime Property Buyers" width="172" height="55">
    </a>
    <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="navMenu"><svg class="nav-ico-open" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg><svg class="nav-ico-close" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <ul class="nav-menu" id="navMenu">
      <li><a href="/"%HOME%>Home</a></li>
      <li class="nav-sub-wrap">
        <button type="button" class="nav-sub-btn" aria-expanded="false" aria-haspopup="true">Services <svg class="nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
        <ul class="nav-sub">
          <li><a href="/sell-your-house-fast/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>Sell house fast</a></li>
          <li><a href="/selling-inherited-property/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>Inherited property</a></li>
          <li><a href="/stop-repossession/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4m0 4h.01"/></svg>Stop repossession</a></li>
          <li><a href="/selling-house-after-divorce/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>Divorce or separation</a></li>
          <li><a href="/selling-house-due-illness/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Ill health or care</a></li>
          <li><a href="/selling-house-pay-debt/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>Financial difficulty</a></li>
          <li><a href="/sell-former-buy-to-let/"><svg class="nav-sub-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>Former buy-to-let</a></li>
        </ul>
      </li>
      <li><a href="/important-advice/"%/important-advice/%>Important Advice</a></li>
      <li><a href="/why-us/"%/why-us/%>Why Us</a></li>
      <li><a href="/faqs/"%/faqs/%>FAQs</a></li>
      <li><a href="/contact/"%/contact/%>Contact</a></li>
      <li class="nav-menu-cta"><a class="btn btn-primary btn-lg" href="/" data-open-modal="leadModal">Get my cash offer <svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></li>
      <li class="nav-menu-cta"><a class="btn btn-wa btn-lg" href="https://wa.me/447719138319" target="_blank" rel="noopener"><svg class="icon" viewBox="0 0 24 24"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.13c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.24-8.23 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg> WhatsApp us</a></li>
      <li class="nav-menu-cta"><a class="btn btn-call btn-lg" href="tel:08000122239"><svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Call 0800 0122 239</a></li>
    </ul>
    <div class="nav-actions">
      <a class="nav-phone" href="tel:08000122239"><svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span class="num">0800 0122 239<small>7 days a week · 8am–8pm</small></span></a>
    </div>
  </div>
</header>"""

# --- canonical FOOTER (edit links here once) ---
FOOTER = """<footer class="site-footer">
  <div class="footer-grid">
    <div class="footer-col">
      <img src="/lp/shared/assets/logo.png?v=2" alt="Prime Property Buyers" class="footer-logo">
      <p class="footer-tagline">Direct cash buyer · Thousands of properties bought · since 1993</p>
      <a class="footer-phone" href="tel:08000122239"><svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> 0800 0122 239</a>
    </div>
    <div class="footer-col">
      <h4>Company</h4>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/important-advice/">Important Advice</a></li>
        <li><a href="/why-us/">Why Us</a></li>
        <li><a href="/faqs/">FAQs</a></li>
        <li><a href="/contact/">Contact</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Our Services</h4>
      <ul>
        <li><a href="/sell-your-house-fast/">Sell house fast</a></li>
        <li><a href="/selling-inherited-property/">Inherited property</a></li>
        <li><a href="/stop-repossession/">Stop repossession</a></li>
        <li><a href="/selling-house-after-divorce/">Divorce or separation</a></li>
        <li><a href="/selling-house-due-illness/">Ill health or care</a></li>
        <li><a href="/selling-house-pay-debt/">Financial difficulty</a></li>
        <li><a href="/sell-former-buy-to-let/">Former buy-to-let</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Useful Information</h4>
      <ul>
        <li><a href="/faqs/">FAQs</a></li>
        <li><a href="/lp/modern-method-of-auction/">Modern Method of Auction</a></li>
        <li><a href="https://primepropertybuyers.uk/terms-conditions/">Terms &amp; Conditions</a></li>
        <li><a href="https://primepropertybuyers.uk/privacy-policy/">Privacy Policy</a></li>
        <li><a href="/contact/">Contact Us</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&copy; 2026 Primepropertybuyers.uk · Marketing name for UK National Properties Ltd · Registered in England No. 12973116</p>
    <nav aria-label="Legal"><a href="https://primepropertybuyers.uk/terms-conditions/">Terms</a><a href="https://primepropertybuyers.uk/privacy-policy/">Privacy</a></nav>
    <p class="footer-credit" style="font-size:11px;opacity:.5;margin-top:.5rem"><a href="https://thejfdesign.co.uk" target="_blank" rel="noopener" style="color:inherit">Site by JF Design</a></p>
  </div>
</footer>"""

# --- canonical LEAD MODAL (the cash-offer popup form). SINGLE SOURCE = the
#     partial modal.html; propagated to the INFO pages so the shared
#     "Get my cash offer" CTA opens it in-place there too. The landing pages
#     keep their own inline copy and are intentionally NOT touched here.
#     Styling comes from the shared forms.css (loaded by the content pages);
#     the form JS is already shared in script.js (wires every .lead-form). ---
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "modal.html"), encoding="utf-8") as _mf:
    MODAL = _mf.read().strip()

MODAL_PAGES = ["contact/index.html", "faqs/index.html",
               "why-us/index.html", "important-advice/index.html"]

# --- canonical TESTIMONIALS (edit the quotes here once; propagated to the
#     pages that use the GENERAL set). The inherited landing page keeps its
#     own tailored probate testimonials and is intentionally NOT in this list. ---
_STAR = ('<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">'
         '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 '
         '5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>')

TESTIMONIAL_DATA = [
    ("Shawn Draper", "Inherited property &middot; April 2026",
     "My siblings and I inherited a property from our mother. To say the property needed work "
     "would be an understatement. Selling via estate agents wasn&rsquo;t really an option. We "
     "contacted Prime Property Buyers and they purchased the property in 5 days. We didn&rsquo;t "
     "have to do any work to the house and they even covered our legal fees."),
    ("Anju Virdee", "Relocation &middot; Watford, April 2026",
     "We needed to relocate quickly so we could be closer to our daughter&rsquo;s new school. "
     "Although we&rsquo;d seen a new build property we liked, we didn&rsquo;t even have our house "
     "on the market. We decided to use Prime Property Buyers to sell our old home and we&rsquo;re "
     "now living in our dream property."),
    ("Afua Okeke", "Emigrating &middot; Luton, May 2026",
     "Despite trying with the estate agents for over 6 months, I was having no luck and needed to "
     "sell my flat quickly as I&rsquo;m due to start a new job in Dubai next month. I called Prime "
     "Property Buyers to see if they would buy my flat. I called them on Tuesday and we completed "
     "the sale by the following Monday. A big thank you to the team!"),
    ("David &amp; Karen Mitchell", "Divorce &middot; Reading, May 2026",
     "Going through a divorce, we needed a clean, quick break rather than waiting months on the "
     "open market. Prime Property Buyers agreed a fair price, dealt with everything through our "
     "solicitor and completed in under three weeks, so we could both move on with our lives."),
    ("Tunde Adeyemi", "Stopping repossession &middot; Slough, March 2026",
     "I&rsquo;d fallen behind on my mortgage and was facing repossession. I called Prime Property "
     "Buyers and they moved fast &mdash; they spoke to my lender directly, completed the purchase "
     "and cleared the arrears before the court date. A huge weight off my shoulders."),
    ("Margaret Hughes", "Broken chain &middot; Maidenhead, May 2026",
     "My buyer pulled out just days before completion and the whole chain collapsed. Prime "
     "Property Buyers stepped in and bought my house within the week, so I didn&rsquo;t lose the "
     "new home I&rsquo;d set my heart on. I can&rsquo;t thank them enough."),
]


def _figure(name, meta, quote, dup):
    stars = "\n          ".join([_STAR] * 5)
    hidden = ' aria-hidden="true"' if dup else ''
    aria = '' if dup else ' aria-label="5 out of 5 stars"'
    return (f'      <figure class="testimonial"{hidden}>\n'
            f'        <div class="t-stars"{aria}>\n'
            f'          {stars}\n'
            f'        </div>\n'
            f'        <blockquote>{quote}</blockquote>\n'
            f'        <figcaption>\n'
            f'          <strong>{name}</strong>\n'
            f'          <span>{meta}</span>\n'
            f'        </figcaption>\n'
            f'      </figure>')


def render_testimonials():
    set1 = "\n\n".join(_figure(*d, dup=False) for d in TESTIMONIAL_DATA)
    set2 = "\n\n".join(_figure(*d, dup=True) for d in TESTIMONIAL_DATA)
    return ("\n\n      <!-- Set 1 -->\n" + set1 +
            "\n\n      <!-- Set 2 (duplicate for the seamless loop) -->\n" + set2 + "\n    ")


# Pages that share the GENERAL testimonials (NOT selling-inherited-property,
# which keeps its own tailored probate reviews).
TESTIMONIALS_PAGES = ["contact/index.html", "index.html",
                      "lp/modern-method-of-auction/index.html",
                      "why-us/index.html", "important-advice/index.html", "faqs/index.html",
                      "sell-your-house-fast/index.html", "sell-former-buy-to-let/index.html"]

ACTIVE_KEYS = ["%HOME%", "%/important-advice/%", "%/why-us/%", "%/faqs/%", "%/contact/%"]


def render_nav(active_path):
    nav = NAV
    for key in ACTIVE_KEYS:
        on = active_path is not None and key.strip("%") == active_path
        nav = nav.replace(key, ' aria-current="page"' if on else "")
    return nav


# --- consistency check: catches drift as the site grows ----------------------
# Every page must carry the same tracking IDs; each page-type must load its
# shared files. Run:  python3 lp/shared/build.py check
TRACK_IDS = ["GTM-5D9NNXQ", "G-MHJNE8WJ6T", "AW-789719856",
             "c64724af-0832-4c2f-8549-e9d1bc265708", "hjid:6590098"]
CONTENT_FILES = ["pp-pages-v2.css", "forms.css", "pp-pages.js", "widgets.js", "widgets.css", "script.js", "footer.css", "nav.css", "nav.js"]
LANDING_FILES = ["styles.css", "script.js", "footer.css", "nav.css", "nav.js"]
CONTENT_PAGES = list(PAGES.keys())
LANDING_PAGES = ["index.html", "selling-inherited-property/index.html",
                 "lp/modern-method-of-auction/index.html",
                 "stop-repossession/index.html", "selling-house-after-divorce/index.html",
                 "selling-house-due-illness/index.html", "selling-house-pay-debt/index.html",
                 "sell-your-house-fast/index.html", "sell-former-buy-to-let/index.html"]


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


# --- sitemap.xml: built from each page's OWN <link rel="canonical">, so it
#     never drifts. After the go-live home->root flip changes the cash-offer
#     canonical to "/", the sitemap follows automatically on the next build.
#     The backend /middle-form/ and any draft are excluded (not in the registry).
def render_sitemap():
    urls, seen = [], set()
    for page in NAV_PAGES.keys():
        fp = os.path.join(ROOT, page)
        if not os.path.exists(fp):
            continue
        m = re.search(r'<link rel="canonical" href="([^"]+)"', open(fp, encoding="utf-8").read())
        if not m:
            print(f"  sitemap WARN: no canonical in {page}"); continue
        u = m.group(1)
        if u not in seen:
            seen.add(u); urls.append(u)
    body = "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{body}\n</urlset>\n")


def main():
    # NAV — the shared header on EVERY page (landing + content)
    for page, active in NAV_PAGES.items():
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
    for page in NAV_PAGES.keys():
        fp = os.path.join(ROOT, page)
        if not os.path.exists(fp):
            print(f"  skip (missing): {page}"); continue
        s = open(fp, encoding="utf-8").read()
        out, n = re.subn(r"<footer class=\"(?:site-footer|brand-bar)\"[^>]*>.*?</footer>", lambda m: FOOTER, s, count=1, flags=re.S)
        if out != s:
            open(fp, "w", encoding="utf-8").write(out)
        print(f"  footer {page:38s} n={n}")
    # TESTIMONIALS — single source for the pages that share the general set.
    # Replaces the figures inside .testimonials-track (up to the carousel/section
    # close) so the quotes are edited in ONE place.
    tst = render_testimonials()
    for page in TESTIMONIALS_PAGES:
        fp = os.path.join(ROOT, page)
        if not os.path.exists(fp):
            print(f"  skip (missing): {page}"); continue
        s = open(fp, encoding="utf-8").read()
        out, n = re.subn(r'(<div class="testimonials-track">).*?(</div>\s*</div>\s*</section>)',
                         lambda m: m.group(1) + tst + m.group(2), s, count=1, flags=re.S)
        if out != s:
            open(fp, "w", encoding="utf-8").write(out)
        print(f"  testim {page:38s} n={n}")
    # LEAD MODAL — inject (or refresh) the cash-offer popup on the INFO pages so
    # the shared "Get my cash offer" CTA opens it in-place. Idempotent: replaces
    # an existing #leadModal, otherwise injects it right after the </footer>.
    for page in MODAL_PAGES:
        fp = os.path.join(ROOT, page)
        if not os.path.exists(fp):
            print(f"  skip (missing): {page}"); continue
        s = open(fp, encoding="utf-8").read()
        if re.search(r'<div class="modal" id="leadModal"', s):
            out, n = re.subn(r'<div class="modal" id="leadModal".*?\n</div>', lambda m: MODAL, s, count=1, flags=re.S)
        else:
            out = s.replace("</footer>", "</footer>\n\n" + MODAL, 1); n = 1 if out != s else 0
        if out != s:
            open(fp, "w", encoding="utf-8").write(out)
        print(f"  modal  {page:38s} n={n}")
    # CREDIT — invisible HTML source comment on every page (JF Design authorship,
    # for view-source). Idempotent: only the part BEFORE <head> is checked, so the
    # visible footer credit never triggers a false "already present".
    CREDIT = "<!-- Prime Property Buyers · Site by JF Design — https://thejfdesign.co.uk -->"
    for page in NAV_PAGES.keys():
        fp = os.path.join(ROOT, page)
        if not os.path.exists(fp):
            continue
        s = open(fp, encoding="utf-8").read()
        if "Site by JF Design" in s.split("<head", 1)[0]:
            continue
        out = re.sub(r"(?i)(<!doctype html>)", lambda m: m.group(1) + "\n" + CREDIT, s, count=1)
        if out != s:
            open(fp, "w", encoding="utf-8").write(out)
        print(f"  credit {page:38s}")
    # SITEMAP — regenerate sitemap.xml from canonicals (drift-proof).
    sm = render_sitemap()
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(sm)
    print(f"  sitemap  sitemap.xml ({sm.count('<url>')} urls)")
    print("Done. Re-preview the pages.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        sys.exit(0 if check() else 1)
    main()
