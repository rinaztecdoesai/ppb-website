<!-- Keep PRs small and focused. Delete sections that don't apply. -->

## What & why
<!-- One or two sentences: what changed and the reason. -->

## Screenshots
<!-- Before/after for any visual change. Note the breakpoint (desktop / mobile). -->

## Checklist
- [ ] Ran `python3 lp/shared/build.py` after editing any **nav / footer / testimonials / lead-modal** markup (these are propagated, not hand-edited per page)
- [ ] Bumped the `?v=N` cache-buster on every **shared file** I changed in `lp/shared/` (e.g. `styles.css?v=89` → `90`) — see CONTRIBUTING.md
- [ ] `python3 lp/shared/build.py check` passes locally (CI runs this too)
- [ ] No secrets / nothing from the `AI Prime/` folder is included (it lives outside this repo — keep it that way)
- [ ] Checked the change at desktop **and** mobile widths
