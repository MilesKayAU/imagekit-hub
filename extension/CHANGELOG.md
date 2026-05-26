# ReadyCode ImageKit — Changelog

## 1.0.3 — Refine + Library remix
- New **Refine** box on every result: type a follow-up instruction ("warmer light, add a wooden tray") and iterate without going back to step 1. Also adds **Use as source** to chain results.
- New **Pick from Library** button on the source row and **Extra reference images** strip — pull any saved ReadyCode Library image in as the source, or combine it with a generated image (e.g. add an ingredient to a scene) and tell the AI how to merge them.
- Library cards now expose **Use as source** and **Add as reference** actions.

## 1.0.2 — Get started onboarding tab
- New default **Get started** tab for first-run users with a 3-step flow: create a ReadyCode account, add your BYOK AI key, paste your connect token. All steps point at `readycode.ai/imagekit/connect`, which now handles signup, BYOK entry, and token issuance inline.
- Auto-hides once a valid token is saved and switches you straight to Respin. The top-right **Link** button stays available for re-linking.

## 1.0.1 — Save to Library 401 fix
- Send the Supabase `apikey` header on every edge-function call (was missing on `imagekit-generate` and `imagekit-save`), which was causing the Supabase functions gateway to reject **Save to Library** with HTTP 401 before the function ran.
- On 401, clear the stored ReadyCode token and surface a clear "Session expired — click Link and paste a fresh token from readycode.ai/imagekit/connect." message instead of a bare `HTTP 401`.


## 1.0.0 — Chrome Web Store submission
- First public Chrome Web Store build.
- Manifest hardened: explicit single-purpose description, `content_security_policy.extension_pages: "script-src 'self'; object-src 'self'"`, no remote code.
- Privacy policy published at <https://readycode.ai/imagekit/privacy>.
- Store listing copy locked in `STORE_LISTING.md`.
- Account-required UX confirmed: clear sign-in CTA when no ReadyCode session is detected.
- Same feature surface as the internal 0.1.6 build (Generate · Respin · Save to Library) with no functional regressions.

## 0.1.6 — Internal
- Correct OpenRouter routing: defaults to `openrouter/auto` when the saved BYOK model is text-only, sends a single OpenRouter request with a `models` fallback list, sets image-only modalities for image-only models, and reports upstream timeouts accurately.

## 0.1.5 — Internal
- Fallback chain hardening: retry on transient OpenRouter HTTP statuses (408/429/500/502/503/504) and auto-correct stale image-model selections.

## 0.1.4 and earlier — Internal dev builds.
