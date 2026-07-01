# Blog — Production Setup (Kereeb → live site, automatically)

How `/blog` stays in sync with Kereeb **in production**, and exactly what a
maintainer with Vercel + GitHub access configures. Read "Why" once; "Do this" is
the checklist.

> **Credentials** (the actual API URL + key) are in **`.github/BLOG-CREDENTIALS.md`**,
> which is excluded from the deployment (`.vercelignore`) so it is never served
> publicly.

---

## Why a rebuild is needed (the one concept that explains everything)

`/blog` is **static HTML**, generated from the Kereeb Content API by
`lp/shared/blog-build.py` **at build time**. It is *not* a live server that
queries the API on each request (that's how the sister Next.js sites work).

So: **publishing an article in Kereeb updates the API, but the live site's HTML
does not change until something regenerates it.** Automating that "something" is
the whole job here — otherwise a human must run the build after every publish.

```
Publish in Kereeb ─► Content API updated ─► [ REBUILD ] ─► new /blog HTML ─► Vercel deploys ─► live
                                                 ▲
                                    the piece we automate
```

---

## Recommended design: GitHub Actions rebuilds, Vercel deploys

The engine is a committed workflow: **`.github/workflows/rebuild-blog.yml`**.

On a schedule (and on demand) it:
1. Runs `verify-kereeb.py` — a **live API probe**. If Kereeb is unreachable it
   **stops**, so a transient outage can never overwrite real articles with the
   empty state. *(The generator fails closed to an empty page, so every rebuild
   is gated behind a confirmed-healthy API — this guard is deliberate.)*
2. Runs `blog-build.py` — regenerates `blog/**` and updates `sitemap.xml`.
3. Commits + pushes **only if something changed**.
4. Vercel auto-deploys on that push. Article is live.

Triggers:
- **Hourly schedule** — publish in Kereeb, live within the hour, zero manual steps.
- **Manual "Run workflow"** (GitHub → Actions → rebuild-blog → Run) — instant on demand.
- **`repository_dispatch: kereeb-publish`** — reserved for a future Kereeb publish
  webhook to make it instant. Not required for the hourly/manual flow.

Why this over letting Vercel run the Python build:
- Last-good blog HTML is always committed → **Kereeb downtime never takes the
  live blog down**; every change is auditable and revertable.
- No dependency on the Vercel build image having Python.
- Same pattern is reusable for every client site.

### Do this (one-time, ~2 min)

Add two **repository secrets** (repo → Settings → Secrets and variables →
**Actions** → New repository secret) using the values in
`.github/BLOG-CREDENTIALS.md`:

- `KEREEB_API_URL`
- `KEREEB_API_KEY`

Then GitHub → Actions → **rebuild-blog** → **Run workflow** once to publish
immediately. The hourly schedule keeps it in sync after that.

> If `main` becomes branch-protected, allow `github-actions[bot]` to push (or use
> a deploy PAT). Unprotected today, so it works as-is.

---

## Alternative: let Vercel run the build (env vars on Vercel)

If you prefer Vercel to regenerate the blog on each deploy instead of committing
built HTML, set **Vercel → Project → Settings**:

- **Build Command:** `python3 lp/shared/blog-build.py`
- **Output Directory:** `.`
- **Environment Variables** (Production + Preview): `KEREEB_API_URL`,
  `KEREEB_API_KEY` (values in `.github/BLOG-CREDENTIALS.md`).

To auto-refresh after a publish without a code push: create a Vercel **Deploy
Hook** (Settings → Git → Deploy Hooks) and ping it on a schedule (cron-job.org or
a small GitHub Actions cron curling the hook).

Trade-off: a build that runs while Kereeb is briefly unreachable regenerates the
empty state and deploys it (the next good build self-heals). The recommended path
avoids this. **Pick one path** — both use the same two credentials.

---

## Local development

Both read `.env.local` (gitignored — `cp .env.example .env.local` and fill in).

- **One-off build:** `python3 lp/shared/blog-build.py`
- **Auto-rebuilding dev server** (no command after each publish):

  ```bash
  python3 lp/shared/blog-dev.py
  # → http://localhost:8770/blog/  — publish in Kereeb, wait ~15s, refresh.
  ```

  `blog-dev.py` serves the site and re-runs the build on a short loop, so newly
  published articles appear on refresh — the local mirror of the production
  automation.

---

## Verify it works

- **API serving the post:**
  `curl -H "x-kereeb-key: <key>" "https://kereeb-clone-production.up.railway.app/api/content/posts?limit=5"`
- **Article renders:** open `/blog/<slug>/` on the deployed site.
- **Workflow health:** GitHub → Actions → rebuild-blog → latest run green, showing
  "Pushed blog update" or "No blog changes".
