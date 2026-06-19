# Contributing

This is a **static HTML/CSS/JS site** — no framework, no build server. What's in
the repo is what ships. Sevalla serves the files straight from `main` (see
[DEPLOY.md](DEPLOY.md)).

## Prerequisites
- `git`
- `python3` (only for `build.py` and the local preview server — no packages to install)

## Workflow (everyone, every change)
1. Branch off `main`: `git checkout -b your-name/short-description`
2. Make the change. Preview locally (below).
3. If you touched nav / footer / testimonials / lead-modal markup → **run the build** (below).
4. If you changed a shared file → **bump its cache-buster** (below).
5. Commit, push, open a **Pull Request** into `main`.
6. CI runs `build.py check`. Get a review. Merge → Sevalla auto-deploys.

> `main` is protected — no direct pushes. All changes go through a PR.

## Preview locally
From the repo root:
```bash
python3 -m http.server 8770
```
Then open http://localhost:8770/ (it redirects to the home page,
`/lp/pp-cash-offer/`). Pages live at their folder, e.g. `/faqs/`, `/contact/`.

## The build step — `lp/shared/build.py`
The header **nav**, the **footer**, the **testimonials** block and the **lead
modal** are *single-sourced* in `lp/shared/build.py` and copied into every page.
**Do not hand-edit those regions in individual pages** — edit the constant in
`build.py`, then run:
```bash
python3 lp/shared/build.py        # propagate to all pages
python3 lp/shared/build.py check  # verify every page is in sync (CI runs this)
```
If `check` reports `DRIFT`, you edited a propagated region by hand or forgot to
run the build. Run the build and commit the result.

## Cache-busting — bump `?v=N` on shared-file edits
Shared assets are served with a `?v=N` query string (e.g.
`styles.css?v=92`). Sevalla/CDN/browsers cache by the **full URL including the
query**, so an edit without a version bump serves the *old* cached file.

**Rule: whenever you edit a file in `lp/shared/` that pages reference with
`?v=N`, increment N in every page that references it.** The common ones:
`styles.css`, `script.js`, `nav.css`, `nav.js`, `footer.css`, and the shared
images in `lp/shared/assets/` (`logo.png`, `trade-bodies.png`, hero images).

Quick way to bump one across the repo (example: styles.css 89 → 90):
```bash
grep -rl 'styles.css?v=92' . | grep -v _archive \
  | xargs sed -i '' 's/styles.css?v=92/styles.css?v=92/g'   # macOS sed
```

## Page types (orientation)
- **Landing pages** (`lp/pp-cash-offer/`, `lp/modern-method-of-auction/`, and the
  root situation/service pages) use `lp/shared/styles.css`.
- **Content pages** (`why-us/`, `important-advice/`, `faqs/`, `contact/`) use
  `lp/shared/pp-pages-v2.css`.
- Shared across all: `nav.css`/`nav.js`, `footer.css`, `forms.css`,
  `widgets.*`, `script.js`, `modal.html`.

## Don't
- **Never commit anything from `AI Prime/`** — it holds API keys/secrets and
  lives *outside* this repo (a sibling folder). Keep it that way.
- Don't commit secrets, `.env` files, or credentials of any kind.
- Don't hand-edit the propagated nav/footer/testimonials/modal regions (see above).

## Commit authorship
Commits to this repo are authored **`Jamie <jamie@thejfdesign.co.uk>`**.
