The GitHub release tag `latest-build` doesn't exist, so the download 404s. The same zip is already hosted on this site at `/readycode-imagekit-oss.zip` (served from `public/`), so we'll point the Install page at that and link the repo for source browsing.

## Changes (src/routes/install.tsx only)

1. Replace `GITHUB_LATEST_BUILD_ZIP` with `HOSTED_ZIP = "https://imagekit.readycode.ai/readycode-imagekit-oss.zip"`.
2. Replace `GITHUB_LATEST_BUILD_RELEASE` with `GITHUB_REPO = "https://github.com/MilesKayAU/imagekit-hub"`.
3. Update the download button + inline link to use `HOSTED_ZIP` (filename text → `readycode-imagekit-oss.zip`).
4. Rename "Open GitHub release page" → "View source on GitHub" pointing at `GITHUB_REPO`.

No other files, no version bump, no extension changes.