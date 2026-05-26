# Seed project with ReadyCode ImageKit extension

This project will host the Chrome extension source from `readycode-imagekit-oss.zip`. The zip is a standalone MV3 Chrome extension (no build step), so the files go at the repo root exactly as shipped — this repo becomes the source of truth that ships to GitHub Releases.

## Steps

1. Copy the 10 files from the uploaded zip to the project root:
   - `manifest.json`, `background.js`, `icon.png`
   - `sidepanel.html`, `sidepanel.css`, `sidepanel.js`
   - `README.md`, `LICENSE`, `PRIVACY.md`, `CHANGELOG.md`
   
   Note: this overwrites the existing `README.md`.

2. Leave the TanStack Start scaffold (`src/`, `vite.config.ts`, `package.json`, etc.) in place. The extension files are independent of it and load directly from the repo root via "Load unpacked" in Chrome. We can prune the web scaffold in a follow-up if you want a pure extension repo.

3. After seeding, you handle steps 3–4 from your message (Connect to GitHub, cut `v1.0.0` release with the zip attached).

## Open questions

- **Prune the web scaffold?** Do you want me to also delete the TanStack Start files (`src/`, `vite.config.ts`, `bun.lock`, etc.) so the repo contains *only* the extension? Or keep them around (e.g. for a future landing page)?
- **Repackage zip on release?** Want a script (`scripts/package.sh`) that zips the 6 extension files into `readycode-imagekit-oss.zip` for attaching to GitHub Releases? Recommended so v1.0.1+ stays reproducible.
