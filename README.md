# ReadyCode ImageKit

Free, open-source, BYOK (bring-your-own-key) AI image studio that lives in the Chrome side panel. Generate images from a prompt, respin any image on the web, and save results to your private [ReadyCode](https://readycode.ai) library.

**License:** MIT — fork it, audit it, ship your own build.

## Install (unpacked, for development or audit)

1. Download or clone this repo.
2. Open `chrome://extensions` in Chrome / Edge / Brave / Arc.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Pin the ImageKit icon and open the side panel.

Production installs ship via the Chrome Web Store — see <https://readycode.ai/downloads>.

## How it works

- **You bring the AI key.** ImageKit calls image models via the AI provider key you store in your ReadyCode account (OpenRouter, OpenAI, or any OpenAI-compatible endpoint). ReadyCode does not mark up inference — your provider bills you directly.
- **You need a free ReadyCode account** so the extension can route the request to your key and save results to your library. Sign up at <https://readycode.ai/signup>.
- **Privacy:** the extension only acts when you click. No background page reads, no analytics, no tracking. Full policy in [`PRIVACY.md`](./PRIVACY.md).

## What's in this repo

| File | Purpose |
|---|---|
| `manifest.json` | Chrome MV3 manifest |
| `background.js` | Service worker — context menu, message routing |
| `sidepanel.{html,css,js}` | Side panel UI |
| `icon.png` | Toolbar icon |
| `PRIVACY.md` | Privacy policy |
| `CHANGELOG.md` | Release notes |
| `LICENSE` | MIT |

## What's NOT in this repo (and won't be)

The ReadyCode account system, BYOK vault, library storage bucket, and the edge functions that broker provider calls are part of the closed ReadyCode service. The extension talks to them over a public HTTPS API.

## Contributing

Issues and PRs welcome. Keep the extension dependency-free (no bundler, no npm) so anyone can audit a diff by reading the files.

## Contact

privacy@readycode.ai · <https://readycode.ai>
