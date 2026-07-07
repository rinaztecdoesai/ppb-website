# Blog — Production Setup (Kereeb → live site, automatically)

How `/blog` stays in sync with Kereeb **in production** on Sevalla, and exactly what a maintainer configures.

---

## Why a rebuild is needed

`/blog` is **static HTML**, generated from the Kereeb Content API by `lp/shared/blog-build.py` at build time.

Publishing an article in Kereeb updates the API, but the live site's HTML does not change until the repo rebuilds and deploys the generated blog files.

```text
Publish in Kereeb ─► Content API updated ─► GitHub Actions rebuild ─► blog/** committed ─► Sevalla auto-deploys
```

---

## Production design

The committed workflow is **`.github/workflows/rebuild-blog.yml`**.

Kereeb triggers the workflow immediately via GitHub `repository_dispatch` whenever published content changes (publish, edit, unpublish, delete, or scheduled publish). The hourly schedule is only a fallback if GitHub or the webhook call is temporarily unavailable.

When it runs, it:

1. Runs `verify-kereeb.py` as a live API probe.
2. Stops before generating files if Kereeb is unreachable.
3. Runs `blog-build.py` to regenerate `blog/**` and `sitemap.xml`.
4. Removes generated article folders that are no longer returned by Kereeb.
5. Commits and pushes only if generated output changed.
6. Lets Sevalla auto-deploy from `main`.

This keeps the last-good blog HTML committed during a Kereeb outage, but removes unpublished articles after a successful API response.

---

## One-time GitHub setup

Add these as **GitHub Actions repository secrets**:

- `KEREEB_API_URL`
- `KEREEB_API_KEY`

Path: repo → Settings → Secrets and variables → Actions → New repository secret.

Do not commit live Kereeb credentials to the repo.

After the secrets are set, run GitHub → Actions → **rebuild-blog** → **Run workflow** once to verify the rebuild path.

In Kereeb, configure the rebuild per site (no environment variables). Go to
**Sites → this site → Edit → Auto-rebuild** and set:

- Type: **GitHub repository dispatch**.
- Repository: `thejfdesign/ppb-website` (owner/repo for this PPB website repo).
- Access token: a fine-grained GitHub token scoped to this repo with permission
  to create repository dispatch events (Contents/Actions).
- Event type: `kereeb-publish` (must match the workflow `repository_dispatch` type).

Then click **Send test rebuild** — it should trigger the `rebuild-blog` GitHub
Action. Each connected site stores its own webhook (encrypted at rest), so this
scales to any number of static client sites without global Kereeb config.

The hourly schedule keeps the blog in sync only as a safety net after that.

---

## Sevalla setup

Sevalla should deploy a clean generated public directory, not the raw repo root.

Set the static site build settings to:

| Setting | Value |
|---|---|
| Build site before publishing | Enabled |
| Build command | `scripts/build-sevalla-public.sh` |
| Publish directory | `_sevalla_public` |
| Error file | `404.html` |

The build command copies only public website files into `_sevalla_public` and excludes repo tooling, docs, env examples, GitHub workflows, local agent files, and Python build scripts.

---

## Local development

Both local blog tools read `.env.local`, which is gitignored.

Create it from the template and fill in the values locally:

```bash
cp .env.example .env.local
```

One-off blog build:

```bash
python3 lp/shared/blog-build.py
```

Auto-rebuilding local dev server:

```bash
python3 lp/shared/blog-dev.py
# → http://localhost:8770/blog/
```

---

## Verify it works

- API serving posts: `curl -H "x-kereeb-key: <key>" "$KEREEB_API_URL/api/content/posts?limit=5"`
- Static site consistency: `python3 lp/shared/build.py check`
- Sevalla artifact safety: `scripts/build-sevalla-public.sh`
- Article renders: open `/blog/<slug>/` on the deployed site.
- Workflow health: GitHub → Actions → rebuild-blog → latest run green, showing `Pushed blog update` or `No blog changes`.
