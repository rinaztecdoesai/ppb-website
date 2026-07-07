# Blog deployment and handoff

This document explains what this pull request adds, how it is deployed on your Sevalla hosting, and what you need to do on your side. It is written for the person who manages the repository and the Sevalla project.

## What we need from you (two quick things)

1. **Add the Kereeb credentials** as GitHub Actions secrets, `KEREEB_API_URL` and `KEREEB_API_KEY`. Copy and paste them, details in section 3.
2. **Create a GitHub token** and send it to us, so publishing in Kereeb rebuilds the blog instantly. Steps in section 5. This one is optional, without it the blog still updates every hour on its own.

Everything else, the Sevalla build and the deploys, is already wired up in this PR.

## 1. What this PR adds

This PR adds a `/blog` to the site. The blog is static HTML, generated from your Kereeb content at build time, so it is fully crawlable and fast, and no API key ever reaches the browser.

On your existing pages the only change is one new nav item, a `Blog` link, added to the desktop menu and to the footer. Nothing else on those pages changes. Your reviews, testimonials, review dates, and page copy are all untouched. You can confirm this yourself, the diff on every existing page shows only the added `Blog` link and no removed lines.

## 2. Answers to your two review points

**"The rebase reverted some of my live edits."** That is fixed. This branch was rebuilt from your current `main`, and the blog was added on top with a surgical edit. Your testimonial changes, the rolling review months, and your content edits are all preserved. The only edit to your existing files is the single `Blog` nav link.

**"Make sure nothing private is served on Sevalla, and the key is not exposed."** Sevalla does not serve the repository directly. The build command produces a clean public folder, `_sevalla_public`, using an allow list, `scripts/build-sevalla-public.sh`. That folder contains only the static site. The Python tooling under `lp/shared`, the `.github` folder, and every `.env` file are stripped out, and the build fails if any private file ever leaks in. The committed credentials file has been removed from the repository, and no key is committed anywhere. The Kereeb URL and key live only in your GitHub Actions secrets, which are never exposed to the browser or to visitors.

## 3. GitHub Actions secrets to add

In the repository, go to Settings, then Secrets and variables, then Actions, and add these two repository secrets.

| Secret name | Value |
| --- | --- |
| `KEREEB_API_URL` | `https://kereeb-clone-production.up.railway.app` |
| `KEREEB_API_KEY` | the key we send you privately |

The key is sent to you privately, not in this repository and not in this document.

## 4. Sevalla settings to confirm

In your Sevalla application, confirm these settings.

- Source type: Private GIT repository, GitHub, this repository, branch `main`.
- Automatic deployments: ON.
- Build command: `bash scripts/build-sevalla-public.sh`
- Publish directory: `_sevalla_public`
- Node version: 20.

With automatic deployments on, every push to `main` triggers a fresh build and deploy.

## 5. Optional instant rebuild via a GitHub token

The site is static HTML served from a CDN, with no application server behind it. Because there is no backend to receive a live rebuild signal, publishing in Kereeb triggers a GitHub Actions run that regenerates the static blog and commits it, which Sevalla then deploys. That is why an instant rebuild needs a GitHub token, so Kereeb can tell this repository to rebuild the moment you publish. This is standard for static hosting and it is optional, without a token the same workflow still runs on an hourly schedule, so content goes live automatically either way.

To enable instant rebuilds, please do this once.

1. In GitHub, go to your profile, then Settings, then Developer settings, then Personal access tokens, then Fine-grained tokens, and press Generate new token.
2. Name it something like `kereeb-blog-rebuild`. Under Repository access choose Only select repositories and pick this repository.
3. Under Permissions, open Repository permissions and set Contents to Read and write. Leave everything else as No access.
4. Generate the token and copy it. GitHub shows the value only once.
5. Send the token to us by replying to this pull request. We add it to the Kereeb platform for you, so Kereeb can trigger the rebuild. The token is only ever stored inside Kereeb, encrypted, and never committed to the repository.

If you would rather not use a token, skip this section. The hourly schedule keeps the blog up to date on its own.

## 6. How to verify it works

1. Add the two secrets in section 3.
2. Publish a test post in Kereeb.
3. In the repository, open the Actions tab and watch the `rebuild-blog` run go green.
4. Within a few minutes the post is live at `https://primepropertybuyers.uk/blog/`.

If you want to trigger a rebuild by hand at any time, open the Actions tab, choose `rebuild-blog`, and press Run workflow.
