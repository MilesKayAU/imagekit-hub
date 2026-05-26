## Context

readycode.ai is rewriting `/imagekit/connect` into a 3-step page (Account → BYOK key → Copy token + "Open ImageKit"). All signup, BYOK entry, and token issuance happen there — this repo does NOT need any auth, signup, or BYOK UI of its own. Our job is to make sure the **extension's first-run experience** and the **install page** funnel new users into that flow cleanly.

## 1. Extension side panel — add a "Get started" tab

A brand-new user opens the side panel today and sees the Respin tab with a disabled Generate button and a tiny "Sign in at readycode.ai" hint. Replace that with a proper onboarding surface.

**`extension/sidepanel.html`**
- Add a new first tab: `<button class="tab" data-tab="welcome">Get started</button>`.
- Add `<section id="tab-welcome" class="tab-panel">` with three numbered steps:
  1. **Create your ReadyCode account** — button → `https://readycode.ai/imagekit/connect` (the connect page now handles signup inline).
  2. **Add your AI provider key** — short BYOK explainer; same button → `https://readycode.ai/imagekit/connect` (step 2 of that page).
  3. **Paste your connect token** — button that opens the existing Link dialog (`linkDialog.showModal()`).
- One-line footer: "Already linked? Switch to Respin."

**`extension/sidepanel.js`**
- In `bootstrap()`: if `state.token` is missing → programmatically activate the Welcome tab and hide it from the tab bar once a valid token is saved.
- When a token gets saved via the Link dialog or external message → auto-switch to Respin.
- Keep the existing top-right "Link" button for re-linking later.

**`extension/sidepanel.css`** — small styles for the welcome step list (no new tokens).

**`extension/manifest.json`** — bump `version` from `1.0.1` → `1.0.2` so the GitHub release zip and the install page reflect the change.

**`extension/CHANGELOG.md`** — one-line entry: "1.0.2 — Added Get started onboarding tab that walks new users through signup, BYOK, and linking on readycode.ai/imagekit/connect."

## 2. Public install page — match the new connect flow

**`src/routes/install.tsx`** — rewrite the "Then: link ReadyCode" section so it mirrors the new one-page connect flow:
1. "Open `readycode.ai/imagekit/connect` — sign up (or sign in) inline."
2. "Add your AI provider key in the same flow (OpenRouter recommended — one key, 100+ models)."
3. "Copy the connect token shown at the bottom."
4. "Click the extension icon to open the side panel, then the **Link** button (or the **Paste token** step on the Get started tab) and paste."

No version constant change needed — it already reads from `manifest.json`.

## Out of scope

- No signup, BYOK, or auth UI in this repo — readycode.ai owns all of that.
- No deep-link/postMessage handshake from the connect page back to the extension. The flow stays copy-paste, as agreed on the readycode.ai side ("copy + clear button" path).
- No changes to API calls, generation, library, GitHub Actions, or release packaging beyond the version bump.

## Verification

After build:
- Fresh unpacked extension (no stored token): Welcome tab is active by default; each of the 3 CTAs opens the right URL / dialog.
- Paste a valid token via the Link dialog: Welcome tab disappears, Respin becomes active, providers load.
- `/install` page shows `v1.0.2` and the 4 linking steps match the readycode.ai connect-page flow.
