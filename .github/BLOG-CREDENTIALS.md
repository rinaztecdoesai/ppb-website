# Kereeb Content API — Prime Property Buyers (production credentials)

> **For the maintainer configuring deployment.** These are the live build-time
> credentials for PPB's Kereeb site. Add them to the secret store for whichever
> automation path you choose (see `../BLOG-SETUP.md`), then **rotate the key in
> Kereeb** so the value in this repo is no longer active — standard handoff
> hygiene.
>
> This file lives under `.github/` and is listed in `.vercelignore`, so it is
> **never uploaded to Vercel and never served publicly**. It exists only for the
> repo maintainer.

| Variable         | Value                                                |
| ---------------- | ---------------------------------------------------- |
| `KEREEB_API_URL` | `https://kereeb-clone-production.up.railway.app`     |
| `KEREEB_API_KEY` | `kereeb_live_K34HDtHXFOPdWKhnVNKfoK1W6rd0BDR2`       |

The key is sent as the `x-kereeb-key` header and is used **only at build time**;
it never reaches the browser or any client-side code.

Where these go, depending on the path chosen in `BLOG-SETUP.md`:

- **GitHub Actions path (recommended):** repo → Settings → Secrets and variables
  → **Actions** → add both as repository secrets (same names).
- **Vercel-native build path:** Vercel project → Settings → **Environment
  Variables** → add both (Production + Preview), and set Build Command
  `python3 lp/shared/blog-build.py`, Output Directory `.`.
