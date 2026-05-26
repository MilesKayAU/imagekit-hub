# ReadyCode ImageKit — Changelog

## 1.0.9
- Right-click **Grab this image** now routes to the active tab: if the UGC tab is open, the grabbed image becomes the UGC source; otherwise it lands in Respin as before.

## 1.0.8
- UGC tab: approving a shot now unlocks the next one but no longer auto-generates it — edit the prompt first, then click **Generate shot**.

## 1.0.7 — UGC tab
- New **UGC** tab: pick a subject category (Person / Product / Food / Place), drop a reference image, and hit **Generate prompt pack** — your BYOK text model rewrites a 6-shot prompt chain that keeps subject, outfit, and lighting consistent while varying pose/scene/angle.
- **Step-by-step approval**: generate shot 1, refine if needed, then **Approve & continue** auto-fires shot 2 using shot 1's image as a reference for identity lock. Repeats through shot 6. Each shot has its own Refine box, Save to Library, and Download.
- **Per-tab model picker** with one-tap presets for **Grok Imagine**, **Gemini 3 Pro Image**, and **Nano Banana 2**, plus a free-text OpenRouter model id field. Selection syncs with the Respin tab.
- Requires the ReadyCode `imagekit-enhance-prompt` edge function to accept a custom `system` prompt (already in place since 1.0.4).

## 1.0.6 — Custom OpenRouter model id
- New **Or use any OpenRouter model id** field under the recommended models picker. Paste any image-capable slug from openrouter.ai/models (e.g. `x-ai/grok-imagine`, `google/gemini-2.5-flash-image`) and hit **Use** — the next Generate/Refine routes to that exact model. Works even before the daily catalog has indexed a brand-new model.

## 1.0.5 — Recommended models picker
- New **Browse recommended image models** panel under "Your AI" (shows when your selected BYOK provider is OpenRouter). Sort by **Popularity**, **Price**, or **Speed**, tap **Use this**, and the next Generate/Refine is locked to that specific OpenRouter model id (e.g. `google/gemini-2.5-flash-image`). Tap **Clear** to fall back to `openrouter/auto`.
- Catalog is fetched from `https://readycode.ai/api/public/imagekit/models` (refreshed daily by ReadyCode straight from openrouter.ai) and cached in the side panel for 6 hours.
- Requires the ReadyCode project to expose the public `/api/public/imagekit/models` endpoint and run the daily `imagekit-refresh-models` cron. See the prompt in `.lovable/plan.md`.

## 1.0.4 — Prompt engineering (BYOK)
- New **✨ Enhance with AI** button under the prompt field. Sends your rough prompt to your own BYOK provider, rewrites it as a production-grade image-generation prompt (lighting, lens, composition, mood, palette), and shows the result in an **editable** textarea so you can tweak before hitting Generate. "Use this" applies it to the prompt field; "Re-enhance" generates another variation.
- Requires the ReadyCode edge function `imagekit-enhance-prompt` (text completion via the user's BYOK provider). See the ReadyCode prompt below.

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
