# Prime Property Buyers — site build & maintenance

Static HTML site. Two page types share as much as possible so updates are one edit.

## Page types

| Type | Examples | Stylesheet / JS |
|------|----------|-----------------|
| **Landing pages** (hero + lead form) | `lp/pp-cash-offer/` (home), `selling-inherited-property/` | `lp/shared/styles.css` + `lp/shared/script.js` |
| **Content pages** (info) | `important-advice/`, `faqs/`, `why-us/`, `contact/` | `lp/shared/pp-pages.css` + `pp-pages.js` |

Both link assets root-relative (`/lp/shared/...`) so they work locally (served from project root, port 8770) and live.

## Shared files (edit once → applies everywhere)

- **Design / behaviour:** `pp-pages.css` + `pp-pages.js` (content), `styles.css` + `script.js` (landing)
- **Offer popup:** `offer-modal.css` + `offer-modal.js` (scoped under `#leadModal`; wired by `script.js`)
- **Chatbot + slide-up CTA bar + thin sticky header:** `widgets.css` + `widgets.js` (content pages; landing pages have these inline)
- **Nav + footer (content pages):** single source in **`build.py`**

## Common edits

| You want to… | Do this |
|--------------|---------|
| Change a **nav or footer link** (content pages) | Edit `NAV` / `FOOTER` in `build.py`, then `python3 lp/shared/build.py` |
| Change **styling / a component** | Edit the relevant shared CSS, bump its `?v=` query on the pages |
| Change the **popup, chatbot, or CTA bar** | Edit `offer-modal.*` / `widgets.*`, bump `?v=` |
| Change a **tracking ID** | Find-replace across pages (see `reference_pp_tracking` in memory). Same IDs everywhere. |
| **Add a content page** | Copy an existing content page, swap `<head>` meta + body, add it to `PAGES` in `build.py`, run `build.py` |
| **Add a landing page** | `cp lp/pp-cash-offer/index.html <slug>/index.html`, fix paths `../shared/`→`/lp/shared/`, swap head meta + hero + body |

## Before deploying

1. `python3 lp/shared/build.py check` — must print **All consistent.** (verifies tracking IDs + shared-file links on every page)
2. **Bump the `?v=` cache-buster** on any shared CSS/JS you changed (browsers + Cloudflare cache by full URL incl. query).
3. Upload the changed page folders **+** any changed `lp/shared/*` files.
4. Purge **both** Cloudflare layers (Kinsta CF + personal CF).

## Notes / deliberate choices

- **Nav/footer are propagated into static HTML** (via `build.py`), not JS-injected — keeps links in the markup for SEO/LLM indexing and avoids a load flash.
- **Popup / chatbot / sticky bar ARE JS-injected** — they're not SEO content, so injection is fine and keeps them DRY.
- **Landing-page nav is intentionally separate** from `build.py` (different stylesheet; avoids touching the live conversion page). If landing pages multiply and nav changes get tedious, unify then.
- Tracking is duplicated per page on purpose (must be inline in `<head>` in a fixed order); it's stable and `check` guards it.
