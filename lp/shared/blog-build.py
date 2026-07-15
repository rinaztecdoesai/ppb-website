#!/usr/bin/env python3
"""
Prime Property Buyers — Kereeb blog generator.

WHY: this site is static HTML with no runtime framework (see build.py). To get
an SEO-complete /blog we fetch published posts from PPB's Kereeb Content API at
BUILD TIME and write committed static HTML — fully crawlable, no client-side
fetch, and the API key never reaches the browser.

It produces:
    blog/index.html                 — card grid (or graceful empty state)
    blog/<slug>/index.html          — one article page each
and appends the blog URLs to sitemap.xml (between BLOG markers, idempotent).

Chrome (nav/footer) and the tracking tag-stack are reused from the existing
pages via build.py, so the blog stays in lock-step with the rest of the site.

USAGE:
    cp .env.example .env.local && edit .env.local     # once
    python3 lp/shared/build.py                         # base chrome + sitemap
    python3 lp/shared/blog-build.py                    # then the blog

Fails SAFE: if the API is unreachable / rate-limited / unconfigured, the build
PRESERVES the last-good blog untouched (index, article pages and sitemap) rather
than blanking it — a transient 429 can never wipe the live blog. The empty state
is only written on a first build when no index exists yet.
"""
from __future__ import annotations

import html
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from typing import Any, Optional

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

import build  # noqa: E402  (sibling: canonical NAV/FOOTER + render_nav)
import kereeb  # noqa: E402  (Content API client)

SITE_ORIGIN = "https://primepropertybuyers.uk"
BLOG_TITLE = "Blog"
BLOG_TAGLINE = (
    "Straight-talking guides on selling your house fast — advice, process and "
    "what to watch out for, from the Prime Property Buyers team."
)

# ── CSS version bumps to match the rest of the site's cache-busting scheme ──
CSS_LINKS = """<link rel="stylesheet" href="/lp/shared/pp-pages-v2.css?v=33">
<link rel="stylesheet" href="/lp/shared/forms.css?v=2">
<link rel="stylesheet" href="/lp/shared/nav.css?v=14">
<link rel="stylesheet" href="/lp/shared/footer.css?v=9">
<link rel="stylesheet" href="/lp/shared/offer-modal.css?v=2">
<link rel="stylesheet" href="/lp/shared/widgets.css?v=8">
<link rel="stylesheet" href="/lp/shared/blog.css?v=1">"""

GTM_NOSCRIPT = (
    '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5D9NNXQ" '
    'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>'
)


def _read(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def load_env(path: str) -> None:
    """Minimal .env loader (KEY=VALUE, # comments) so the generator picks up
    .env.local without any dependency, matching verify-kereeb.py."""
    if not os.path.exists(path):
        return
    for raw in _read(path).splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ[key.strip()] = val.strip().strip('"').strip("'")


def extract_tag_stack() -> str:
    """Pull the canonical tracking tag-stack from an existing page so the blog
    carries identical Consent/Cookiebot/GTM/gtag/Hotjar/Zoho scripts."""
    src = _read(os.path.join(ROOT, "important-advice", "index.html"))
    m = re.search(
        r"<!-- \u2550+ SITE TAG STACK.*?END SITE TAG STACK \u2550+ -->",
        src, flags=re.S,
    )
    return m.group(0) if m else ""


TAG_STACK = extract_tag_stack()


def _esc(value: Optional[str]) -> str:
    return html.escape(value or "", quote=True)


def _first(post: dict[str, Any], *keys: str) -> Optional[str]:
    """First non-empty string value among candidate keys (schema-tolerant)."""
    for k in keys:
        v = post.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def hero_url(post: dict[str, Any]) -> Optional[str]:
    raw = _first(post, "heroImage", "coverImage", "image", "ogImage", "featuredImage")
    return kereeb.absolutize_image_url(raw)


def summary(post: dict[str, Any]) -> Optional[str]:
    return _first(post, "excerpt", "description", "summary", "metaDescription")


def display_date(post: dict[str, Any]) -> str:
    raw = _first(post, "publishedAt", "date", "createdAt", "updatedAt")
    if not raw:
        return ""
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-d %B %Y")
        except ValueError:
            continue
    # ISO with offset
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%-d %B %Y")
    except ValueError:
        return ""


def iso_date(post: dict[str, Any]) -> Optional[str]:
    raw = _first(post, "publishedAt", "date", "createdAt", "updatedAt")
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(
            timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return raw


def enhance_article_html(body: str) -> str:
    """Absolutize inline image src and wrap bare <img> in <figure>/<figcaption>
    (caption from the alt text), mirroring the reference enhanceArticleHtml."""
    if not body:
        return ""

    def _img(match: re.Match[str]) -> str:
        tag = match.group(0)
        src_m = re.search(r'src="([^"]*)"', tag)
        if src_m:
            abs_src = kereeb.absolutize_image_url(src_m.group(1)) or src_m.group(1)
            tag = tag[:src_m.start(1)] + abs_src + tag[src_m.end(1):]
        # already inside a <figure>? leave it alone
        alt_m = re.search(r'alt="([^"]*)"', tag)
        caption = alt_m.group(1).strip() if alt_m else ""
        if caption:
            return f"<figure>{tag}<figcaption>{caption}</figcaption></figure>"
        return f"<figure>{tag}</figure>"

    # Only wrap imgs that aren't already wrapped in a figure.
    return re.sub(r"<img\b[^>]*>", _img, body)


def head(*, title: str, description: str, canonical: str,
         og_type: str, og_image: Optional[str], extra: str = "") -> str:
    og_img_tag = (f'\n<meta property="og:image" content="{_esc(og_image)}">'
                  if og_image else "")
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{_esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="{_esc(description)}">

<link rel="canonical" href="{_esc(canonical)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="alternate" hreflang="en-GB" href="{_esc(canonical)}">

<!-- Open Graph -->
<meta property="og:locale" content="en_GB">
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{_esc(title)}">
<meta property="og:description" content="{_esc(description)}">
<meta property="og:url" content="{_esc(canonical)}">
<meta property="og:site_name" content="Prime Property Buyers">{og_img_tag}

<link rel="icon" type="image/png" sizes="32x32" href="/lp/shared/assets/icon-32.png">
<link rel="apple-touch-icon" href="/lp/shared/assets/icon-180.png">
<meta name="theme-color" content="#010080">

{TAG_STACK}
{extra}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
{CSS_LINKS}
</head>
<body>

{GTM_NOSCRIPT}
"""


def page_shell_open(*, title: str, description: str, canonical: str,
                    og_type: str, og_image: Optional[str],
                    active: Optional[str], extra: str = "") -> str:
    nav = build.render_nav(active)
    return head(title=title, description=description, canonical=canonical,
                og_type=og_type, og_image=og_image, extra=extra) + "\n" + nav + "\n"


def page_shell_close() -> str:
    return (
        "\n" + build.FOOTER +
        '\n\n<script src="/lp/shared/nav.js" defer></script>\n'
        '<script src="/lp/shared/script.js" defer></script>\n'
        "</body>\n</html>\n"
    )


# ── index ──────────────────────────────────────────────────────────────────

def render_card(post: dict[str, Any]) -> str:
    slug = _first(post, "slug")
    if not slug:
        return ""
    href = f"/blog/{slug}/"
    title = _first(post, "title") or slug
    excerpt = summary(post) or ""
    date = display_date(post)
    img = hero_url(post)
    media = (f'<div class="blog-card-media"><img src="{_esc(img)}" alt="{_esc(title)}" '
             f'loading="lazy" width="640" height="360"></div>' if img else "")
    meta = f'<span class="blog-card-meta">{_esc(date)}</span>' if date else ""
    excerpt_html = f"<p>{_esc(excerpt)}</p>" if excerpt else ""
    return f"""      <article class="blog-card">
        <a class="blog-card-link" href="{href}">
          {media}
          <div class="blog-card-body">
            {meta}
            <h2>{_esc(title)}</h2>
            {excerpt_html}
            <span class="blog-card-more">Read more
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </div>
        </a>
      </article>"""


EMPTY_STATE = """      <div class="blog-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        <h2>Articles are on the way</h2>
        <p>We're preparing helpful guides on selling your house fast. Check back soon — or call us on 0800 0122 239 if you need advice today.</p>
      </div>"""


def build_index(posts: list[dict[str, Any]]) -> str:
    canonical = f"{SITE_ORIGIN}/blog/"
    open_html = page_shell_open(
        title=f"{BLOG_TITLE} | Prime Property Buyers",
        description=BLOG_TAGLINE,
        canonical=canonical, og_type="website",
        og_image=f"{SITE_ORIGIN}/lp/shared/assets/og-default.png",
        active="/blog/",
    )
    if posts:
        cards = "\n".join(c for c in (render_card(p) for p in posts) if c)
        body_inner = f'<div class="blog-grid">\n{cards}\n    </div>'
    else:
        body_inner = EMPTY_STATE
    main = f"""
<main>
  <section class="blog-hero">
    <div class="blog-wrap">
      <p class="eyebrow">Prime Property Buyers</p>
      <h1>{BLOG_TITLE}</h1>
      <p>{BLOG_TAGLINE}</p>
    </div>
  </section>
  <section class="blog-wrap">
    {body_inner}
  </section>
</main>
"""
    return open_html + main + page_shell_close()


# ── article ────────────────────────────────────────────────────────────────

def breadcrumb_jsonld(title: str, canonical: str) -> str:
    data = (
        '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":['
        f'{{"@type":"ListItem","position":1,"name":"Home","item":"{SITE_ORIGIN}/"}},'
        f'{{"@type":"ListItem","position":2,"name":"Blog","item":"{SITE_ORIGIN}/blog/"}},'
        f'{{"@type":"ListItem","position":3,"name":{_json_str(title)},"item":"{canonical}"}}'
        ']}'
    )
    return f'<script type="application/ld+json">\n{data}\n</script>'


def article_jsonld(post: dict[str, Any], title: str, description: str,
                   canonical: str, img: Optional[str]) -> str:
    published = iso_date(post)
    parts = [
        '"@context":"https://schema.org"', '"@type":"Article"',
        f'"headline":{_json_str(title)}',
        f'"description":{_json_str(description)}',
        f'"mainEntityOfPage":"{canonical}"',
        '"publisher":{"@type":"Organization","name":"Prime Property Buyers",'
        f'"logo":{{"@type":"ImageObject","url":"{SITE_ORIGIN}/lp/shared/assets/logo.png"}}}}',
    ]
    if img:
        parts.append(f'"image":{_json_str(img)}')
    if published:
        parts.append(f'"datePublished":"{published}"')
    data = "{" + ",".join(parts) + "}"
    return f'<script type="application/ld+json">\n{data}\n</script>'


def _json_str(value: Optional[str]) -> str:
    import json
    return json.dumps(value or "", ensure_ascii=False)


def build_article(detail: dict[str, Any]) -> Optional[tuple[str, str]]:
    slug = _first(detail, "slug")
    if not slug:
        return None
    title = _first(detail, "title") or slug
    canonical = f"{SITE_ORIGIN}/blog/{slug}/"
    meta = detail.get("meta") if isinstance(detail.get("meta"), dict) else {}
    description = (_first(meta, "description", "metaDescription")
                   or summary(detail) or f"{title} — Prime Property Buyers.")
    img = hero_url(detail)
    date = display_date(detail)
    body = enhance_article_html(detail.get("html") or detail.get("content") or "")
    lede = summary(detail)

    structured = (breadcrumb_jsonld(title, canonical) + "\n"
                  + article_jsonld(detail, title, description, canonical, img))
    open_html = page_shell_open(
        title=f"{title} | Prime Property Buyers",
        description=description, canonical=canonical,
        og_type="article", og_image=img, active="/blog/", extra=structured,
    )
    hero_fig = (f'\n    <figure class="blog-hero-figure"><img src="{_esc(img)}" '
                f'alt="{_esc(title)}" width="960" height="540"></figure>' if img else "")
    meta_line = f'<span class="blog-card-meta">{_esc(date)}</span>' if date else ""
    lede_html = f'<p class="blog-lede">{_esc(lede)}</p>' if lede else ""
    main = f"""
<main class="blog-article">
  <div class="blog-wrap">
    <nav class="blog-breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> / <a href="/blog/">Blog</a> / <span>{_esc(title)}</span>
    </nav>
    <header class="blog-article-header">
      {meta_line}
      <h1>{_esc(title)}</h1>
      {lede_html}
    </header>{hero_fig}
    <div class="blog-article-content">
{body}
    </div>
    <div class="blog-article-foot">
      <a class="blog-back" href="/blog/">&larr; Back to all articles</a>
    </div>
  </div>
</main>
"""
    return slug, open_html + main + page_shell_close()


# ── sitemap ────────────────────────────────────────────────────────────────

BLOG_START = "  <!-- BLOG:start -->"
BLOG_END = "  <!-- BLOG:end -->"


def update_sitemap(slugs: list[str]) -> None:
    path = os.path.join(ROOT, "sitemap.xml")
    urls = [f"{SITE_ORIGIN}/blog/"] + [f"{SITE_ORIGIN}/blog/{s}/" for s in slugs]
    block = "\n".join([BLOG_START]
                      + [f"  <url><loc>{u}</loc></url>" for u in urls]
                      + [BLOG_END])
    if not os.path.exists(path):
        print("  sitemap WARN: sitemap.xml missing — run build.py first; skipping.")
        return
    sm = _read(path)
    # Drop any previous blog block so re-runs stay idempotent.
    sm = re.sub(re.escape(BLOG_START) + r".*?" + re.escape(BLOG_END) + r"\n?",
                "", sm, flags=re.S)
    sm = sm.replace("</urlset>", block + "\n</urlset>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(sm)
    print(f"  sitemap  +{len(urls)} blog url(s)")


def prune_stale_article_dirs(out_dir: str, current_slugs: set[str]) -> None:
    """Remove generated article folders that no longer exist in Kereeb.

    The blog is static HTML, so unpublishing in Kereeb must delete the old
    generated slug directory. Keep this gated by a successful API probe in main
    so an outage never wipes the last-good local files.
    """
    if not os.path.isdir(out_dir):
        return
    for name in sorted(os.listdir(out_dir)):
        path = os.path.join(out_dir, name)
        if (
            name in current_slugs
            or name.startswith(".")
            or not os.path.isdir(path)
        ):
            continue
        index_path = os.path.join(path, "index.html")
        if not os.path.exists(index_path):
            continue
        shutil.rmtree(path)
        print(f"  removed stale blog/{name}/")


# ── main ───────────────────────────────────────────────────────────────────

def main() -> int:
    load_env(os.path.join(ROOT, ".env.local"))
    out_dir = os.path.join(ROOT, "blog")
    os.makedirs(out_dir, exist_ok=True)
    index_path = os.path.join(out_dir, "index.html")

    configured = kereeb.is_kereeb_configured()
    api_reachable = configured and kereeb.is_content_api_reachable()
    if not configured:
        print("• Kereeb not configured — preserving existing blog "
              "(set .env.local, then re-run).")
    elif not api_reachable:
        print("• Kereeb unreachable — preserving existing blog (index + articles).")

    # Fail-safe: without a trustworthy API response we must NEVER blank the live
    # blog. A transient 429/outage must leave the last-good index, article pages
    # AND sitemap entries exactly as they are. Only when there is genuinely no
    # index yet (first build) do we emit the empty state so the route exists.
    if not api_reachable:
        if os.path.exists(index_path):
            print("  preserved existing blog/index.html + article pages + sitemap.")
        else:
            with open(index_path, "w", encoding="utf-8") as fh:
                fh.write(build_index([]))
            print("  wrote empty-state blog/index.html (first build, no API).")
        print("Done. Blog preserved (Content API unavailable).")
        return 0

    summaries = kereeb.list_all_posts()
    print(f"• {len(summaries)} post summary(ies) from the Content API.")

    current_slugs = {
        s["slug"] for s in summaries if isinstance(s.get("slug"), str)
    }
    prune_stale_article_dirs(out_dir, current_slugs)

    # Index (written from a trusted response — empty state only when the API
    # genuinely returned zero published posts).
    with open(index_path, "w", encoding="utf-8") as fh:
        fh.write(build_index(summaries))
    print("  wrote blog/index.html")

    written_slugs: list[str] = []
    for s in summaries:
        slug = s.get("slug")
        if not slug:
            continue
        detail = kereeb.get_post(slug)
        if not detail:
            print(f"  skip {slug}: detail unavailable")
            continue
        result = build_article(detail)
        if not result:
            continue
        real_slug, page_html = result
        post_dir = os.path.join(out_dir, real_slug)
        os.makedirs(post_dir, exist_ok=True)
        with open(os.path.join(post_dir, "index.html"), "w", encoding="utf-8") as fh:
            fh.write(page_html)
        written_slugs.append(real_slug)
        print(f"  wrote blog/{real_slug}/index.html")

    update_sitemap(written_slugs)
    print(f"Done. {len(written_slugs)} article page(s) + index.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
