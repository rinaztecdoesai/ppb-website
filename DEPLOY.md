# Deploying (Sevalla)

This site is plain static HTML/CSS/JS. **No conversion or framework is needed** —
Sevalla's *Static Site* product serves the repo's files directly. The repo
(`thejfdesign/ppb-website`) is the single source of truth; pushing to `main`
deploys.

## Sevalla Static Site — settings
Sevalla dashboard → **Static Sites → Add site**:

| Setting | Value |
|---|---|
| Git provider | GitHub → `thejfdesign/ppb-website` |
| Branch | `main` |
| **Build command** | *(leave empty)* — the HTML is already built and committed |
| **Publish directory** | `.` (repo root — pages live at `/contact/`, `/faqs/`, `lp/…`) |

Auto-deploys on every push to `main`.

> **Why no build command:** `lp/shared/build.py` propagates the shared
> nav/footer/testimonials/modal, but it edits files **in place** and we commit
> the result. It's a *local pre-commit* step (see CONTRIBUTING.md), not a deploy
> build. Keeping the build command empty means the deploy just publishes files.

## Custom domain
1. Sevalla site → **Domains** → add `primepropertybuyers.uk` (and `www`).
2. Point DNS at the records Sevalla shows (A / CNAME). SSL is issued automatically.
3. Test on the temporary `*.sevalla.page` URL **before** moving DNS.

## Redirects — ⚠️ confirm the Sevalla format
Vercel-specific files do **not** apply on Sevalla:
- `vercel.json` — ignored by Sevalla (safe to leave until cutover, then delete).
- `_redirects` — **confirm** whether Sevalla honours this. Sevalla static hosting
  is CDN-backed and may support a `_redirects` file (Netlify/Cloudflare-style) or
  a redirect UI — verify in Sevalla docs and migrate the rules accordingly.

Redirects we need:
- **Now:** `/` → `/lp/pp-cash-offer/` (temporary). This is currently done three
  ways: `vercel.json`, `_redirects`, and the root `index.html` meta-refresh stub.
  The `index.html` stub works on any host, so the home redirect keeps working on
  Sevalla even before redirect rules are configured.
- **At go-live:** the cash-offer page **becomes** the root home page, so the `/`
  redirect goes away (see the GO-LIVE plan). The redirects that matter long-term
  are **old WordPress URLs → new URLs (301)** so SEO rankings aren't lost — set
  these up in Sevalla's redirect mechanism once confirmed.

## ⭐ GO-LIVE redirects & indexing checklist (Rahul's review list — 25 Jun)
Old WordPress URLs → new locations. **Redirect URL pages already created in the repo**
(client-side stubs, work on any host — same approach as `/lp/pp-cash-offer/`). For
SEO-clean **301s**, ALSO add these in the **Sevalla dashboard** redirect feature at
go-live (Sevalla ignores `_redirects`).

| Old URL | → Target | Repo stub | Add 301 in Sevalla |
|---|---|---|---|
| `/testimonials/` | `/#reviews` (homepage reviews) | ✅ done | ⬜ go-live |
| `/selling-your-house-with-japanese-knotweed/` | `/#why-sell` (Why people sell) | ✅ done | ⬜ go-live |
| `/broken-chain-sell-house-for-cash/` | `/#why-sell` | ✅ done | ⬜ go-live |
| `/privacy-policy-2/` | `/privacy-policy/` | ✅ done | ⬜ go-live |
| `/lp/pp-cash-offer/` | `/` | ✅ done | ⬜ go-live |

Homepage anchors added for the section targets: `#reviews` (testimonials section),
`#why-sell` (reasons / "Why people sell to us" section).

- ✅ **noindex** already on `/middle-form/`, `/additional-info/`, `/thank-you/`.
- ✅ **Sitemap** already correct — lists all 15 indexable pages, excludes the 3
  noindex funnel pages, contains no old WP URLs (build.py auto-builds from canonicals).
- ⬜ **Remove `/home-copy-for-rahul/`** — that's a **WordPress** page (NOT in this repo);
  delete it in WP at cutover so it 404s / isn't carried over.
- ⬜ DNS cutover + set Sevalla **Error file = `404.html`**.

## Cutover (Vercel → Sevalla, all-Sevalla)
1. Create the Sevalla static site (settings above); verify it serves identically
   on the `*.sevalla.page` URL.
2. Turn on `main` branch protection + invite the team on GitHub.
3. Move `primepropertybuyers.uk` DNS to Sevalla.
4. Decommission Vercel. Then remove the now-unused `vercel.json` (and
   `_redirects` if Sevalla uses a different mechanism).

## Backend (separate, go-live prerequisite)
The lead form steps 2–4 and the chatbot lead-submit currently POST to WordPress
`/middle-form/`. When WordPress is retired these become a small **Sevalla App
service** (Node/Python) that writes leads to Zoho — tracked in the GO-LIVE plan,
not part of static hosting.

## Sevalla — verified 18 Jun 2026
Live deploy: **https://ppb-website-1rtus.kinsta.page/** (build OFF, publish dir `.`).
End-to-end check passed: home at `/`, all assets, inner pages (with and without
trailing slash), `robots.txt`/`sitemap.xml`/`llms.txt`, and real 404s all serve
correctly; the footer credit renders.

⚠️ **Sevalla does NOT honour the `_redirects` file.** `/lp/pp-cash-offer/` returns
**200 (the stub)**, not a 301 — the stub still redirects visitors client-side, but
for proper **301s** (the go-live old-WP-URL → new map) use **Sevalla's redirect
feature in the dashboard**, not `_redirects`. (`vercel.json` is likewise Vercel-only.)

Still to confirm: per-PR **preview deploys** (toggle on the site's settings).

## Production hardening (done 18 Jun)
- **Self-hosted assets** — favicons + the `og:image` were hotlinked from
  `primepropertybuyers.uk/wp-content/…` (the WordPress server) and would have
  404'd the moment WP is switched off. Now self-hosted in `lp/shared/assets/`
  (`icon-32/192/180.png`, `og-default.png`) and `favicon.ico` at the root; every
  page's head repointed (icons root-relative, `og:image` absolute as OG requires).
  Zero `wp-content` references remain.
- **Custom 404** — `404.html` at the repo root (branded, `noindex`). ⚠️ **Set it in
  Sevalla:** Static Site → Settings → **Error file = `404.html`** (it was left blank
  at creation; until set, Sevalla serves its generic error page).
- **Removed dead config** — `vercel.json`, `_redirects` (Sevalla ignores both), and
  the stale `_PREVIEW_ONLY_READ_ME.txt`. The only redirect now is
  `/lp/pp-cash-offer/ → /` via the client-side stub; real 301s go in Sevalla's
  dashboard at go-live.

---

# SEO migration — replacing the WordPress site

We are replacing the live WordPress site at `primepropertybuyers.uk` with this
static site **on the same domain**. That makes it a *platform swap*, not a domain
move: no Search Console change-of-address, and **9 of the 16 live URLs already
have identical slugs here**, so they swap content with zero ranking disruption.
The risk is the handful of URLs that change — handle them with 301s.

## SEO files in this repo (live as static files at the root)
- **`robots.txt`** — allows search engines + AI *search* crawlers (OAI-SearchBot,
  ChatGPT-User, PerplexityBot, Bingbot), blocks AI *training* crawlers (GPTBot,
  CCBot, Google-Extended, ClaudeBot/anthropic-ai, Applebot-Extended,
  Meta-ExternalAgent, Bytespider). Points to the sitemap.
- **`sitemap.xml`** — **auto-generated by `build.py`** from each page's
  `<link rel="canonical">` (run the build to refresh; never hand-edit). Lists the
  13 real pages, excludes `/middle-form/` and drafts.
- **`llms.txt`** — LLM-facing site summary + page index (GEO).

## Redirect map (implement in Sevalla's redirect mechanism AT go-live)
Same-slug pages (no redirect, content swap only): `/`,
`/selling-house-after-divorce/`, `/selling-house-due-illness/`,
`/selling-house-pay-debt/`, `/selling-inherited-property/`, `/important-advice/`,
`/why-us/`, `/faqs/`, `/contact/`.

301s to add:

| From (old WP URL) | To | Note |
|---|---|---|
| `/privacy-policy-2/` | `/privacy-policy/` | slug changes; build the new page |
| `/lp/pp-cash-offer/` | `/` | after the home→root flip |
| `/selling-your-house-with-japanese-knotweed/` | `/` | page not rebuilt (decision) |
| `/broken-chain-sell-house-for-cash/` | `/` | page not rebuilt (decision) |
| `/testimonials/` | `/` | page not rebuilt (decision) |
| `/home-copy-for-rahul/` | `/` | stray draft; keep OUT of the sitemap |
| `/middle-form/` | (becomes the static form flow) | `noindex`; 301→`/` only if dropped |

Build (same slug, no redirect needed): **`/terms-conditions/`**, **`/privacy-policy/`**.

⚠️ **Do NOT activate the `/lp/pp-cash-offer/ → /` redirect until the home→root
flip is done** — today `/` redirects *to* `/lp/pp-cash-offer/`, so adding the
reverse now creates a loop.

## Go-live: home → root (finalises canonicals + sitemap)
1. Serve the cash-offer page at `/`; repoint internal links/canonical/og:url from
   `/lp/pp-cash-offer/` → `/` (build.py NAV/FOOTER + nav.js + the page's own
   canonical/og), flip `vercel.json`/redirects, add the `/lp/pp-cash-offer/`→`/`
   301. Re-run `build.py` → **sitemap.xml auto-updates** the home URL to `/`.
2. Update the home URL in `llms.txt` if needed.

## Pre / post cutover checklist
- **Before:** don't trust the 16-URL sitemap as complete — pull the full
  historical URL list from **GSC → Pages** and **→ Links** plus a Screaming Frog
  crawl, so no backlinked URL is missed. Confirm every old URL 200s or 301s.
- **At cutover:** switch DNS, then **submit `sitemap.xml` to Google Search Console
  AND Bing Webmaster Tools** (Bing powers ChatGPT browsing — verify the domain in
  both).
- **After (weeks 1–4):** watch GSC Coverage/Pages for 404s + crawl errors, fix any
  missed redirect, monitor rankings. Keep all 301s permanently.

## On-page status (already strong — keep)
Every page: unique title + meta + canonical + OG/Twitter + one H1 + image alt
text + rich JSON-LD (Organization, Service, Offer, AggregateRating, FAQPage,
BreadcrumbList, RealEstateAgent). Home `<title>` updated to retain the "cash"
keyword the old home ranked for. To finish: trim 1–2 over-long meta descriptions.
