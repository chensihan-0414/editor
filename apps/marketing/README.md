# apps/marketing — Step 1 (Custom Prefab House)

Pure HTML/CSS/JS, no framework, no build step. Ported from the standalone
`request` repo into this monorepo so Step 1 (marketing/lead-gen) and Step 2/3
(the Pascal editor) deploy from one place instead of two separate Vercel
projects stitched together by an outbound link.

## Local dev

```bash
cd apps/marketing
bun run dev   # or: npx serve .
```

No env vars, no build command — Vercel (or any static host) serves the
directory as-is.

## Deploying as its own Vercel project

1. On vercel.com → **Add New → Project** → import this same GitHub repo.
2. **Root Directory**: `apps/marketing`.
3. **Framework Preset**: Other (or leave auto-detect — it is plain static
   files, Vercel serves them with no config).
4. Deploy. No environment variables required.

This is a *second* Vercel project pointing at the same repo as
`apps/editor` — see the root README / `wiki/` for how the two are wired
under one domain (subdomain split vs. path-based rewrites).

## Fixed during the port (2026-08-06)

- Removed two byte-identical duplicate stylesheets (`style .css`,
  `style new.css`) that had accumulated from earlier AI-assisted edits —
  only `style.css` is loaded by `index.html`, the other two were dead
  weight.
- Removed an orphaned, malformed image file (`images:style-modern-open.jpg`
  — a colon in the filename, unused by any code path) and a duplicate
  `style-japanese.jpg` that shipped alongside the `.png` actually
  referenced in `script.js`.
- Fixed a state-race bug in the style-accordion's "Use this" button: it
  called `applyRecommendation()` (which sets the recommended-style photo)
  immediately followed by `updateRecommendCard()` (which unconditionally
  clears that same photo slot as part of resetting the card for a fresh
  market selection). Net effect: the photo never rendered when using the
  header's quick-apply button, only when using the recommend-card's own
  "View details" button. Fixed by reordering the two calls — reset first,
  then apply — matching the sequencing that already worked for the other
  entry point.

## Still pointing at the old deployment

`STYLES[].showcaseUrl` in `script.js` currently points at
`https://editor-five-mocha.vercel.app/scene/<id>` — the previous standalone
editor deployment. Once `apps/editor` is deployed under this project's
own domain, update those three URLs (and re-point `STEP2_URL` at the top of
`script.js`, if you set one) to the new location. The scene IDs are tied to
whatever database the target deployment reads from — moving the editor
deployment without also migrating/recreating those three showcase scenes
will break the links.
