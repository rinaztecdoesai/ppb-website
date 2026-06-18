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

## Still to confirm in Sevalla
- Redirect-rule format (`_redirects` vs UI) — see above.
- Per-PR / per-branch **preview deploys** (we review via the preview URL + GitHub
  diffs now that we're all-Sevalla).
