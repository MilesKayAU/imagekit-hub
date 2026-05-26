# ReadyCode ImageKit

Free, open-source, BYOK (bring-your-own-key) AI image studio that lives in the Chrome side panel. Generate images from a prompt, respin any image on the web, and save results to your private [ReadyCode](https://readycode.ai) library.

**License:** MIT — fork it, audit it, ship your own build.

---

## Download

The extension source lives in the [`extension/`](./extension) folder. Two ways to get it:

### Option A — Packaged zip (recommended)

Grab the latest release zip — it contains only the extension files, nothing else:

```
https://github.com/<org>/imagekit-hub/releases/latest/download/readycode-imagekit.zip
```

Unzip it anywhere.

### Option B — Clone the repo

```bash
git clone https://github.com/<org>/imagekit-hub.git
cd imagekit-hub/extension
```

The `extension/` folder is the entire extension — every other file in this repo is build tooling and can be ignored.

---

## Install (unpacked, for development or audit)

1. Get the files (see Download above).
2. Open `chrome://extensions` in Chrome / Edge / Brave / Arc.
3. Enable **Developer mode** (toggle, top right).
4. Click **Load unpacked** and select the `extension/` folder (or the unzipped folder).
5. Pin the ImageKit icon in the toolbar and open the side panel.

Production installs ship via the Chrome Web Store — see <https://readycode.ai/downloads>.

---

## How it works

- **You bring the AI key.** ImageKit calls image models via the AI provider key you store in your ReadyCode account (OpenRouter, OpenAI, or any OpenAI-compatible endpoint). ReadyCode does not mark up inference — your provider bills you directly.
- **You need a free ReadyCode account** so the extension can route the request to your key and save results to your library. Sign up at <https://readycode.ai/signup>.
- **Privacy:** the extension only acts when you click. No background page reads, no analytics, no tracking. Full policy in [`extension/PRIVACY.md`](./extension/PRIVACY.md).

## What's in `extension/`

| File | Purpose |
|---|---|
| `manifest.json` | Chrome MV3 manifest |
| `background.js` | Service worker — context menu, message routing |
| `sidepanel.{html,css,js}` | Side panel UI |
| `icon.png` | Toolbar icon |
| `PRIVACY.md` | Privacy policy |
| `CHANGELOG.md` | Release notes |

## Building the release zip

Maintainers only:

```bash
bash scripts/package.sh
```

Produces `readycode-imagekit.zip` at the repo root, ready to attach to a GitHub Release.

## What's NOT in this repo (and won't be)

The ReadyCode account system, BYOK vault, library storage bucket, and the edge functions that broker provider calls are part of the closed ReadyCode service. The extension talks to them over a public HTTPS API.

## Contributing

Issues and PRs welcome. Keep the extension dependency-free (no bundler, no npm) so anyone can audit a diff by reading the files.

## Contact

privacy@readycode.ai · <https://readycode.ai>
