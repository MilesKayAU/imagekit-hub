# ReadyCode ImageKit — Changelog

## 1.0.28 — Library renders saved videos + de-duped Save button
- The Library tab now detects video assets (`kind=video`, `video/*` mime, or `.mp4/.webm/.mov/.m4v` storage path) and renders them in an inline `<video controls>` player with a "▶ video" badge instead of a broken `<img>` icon. Each video card has `Open` and `Download` buttons.
- "Save to Library" on each Image → Video slot is now idempotent: the button flips to `Saving…` (disabled) while in flight and to `Saved ✓` (disabled) afterwards, so double-clicks no longer create duplicate library rows.

## 1.0.27 — Stay faithful to source image (Image → Video)
- Each Image → Video slot now has a "Stay faithful to source image" toggle (default ON). When enabled, the extension prepends a lock-frame instruction to the prompt that tells the model to treat the uploaded image as a pixel-accurate first frame and only add motion — no redesigning the subject, no new objects, no new hands/people. Especially important for Grok Imagine, which otherwise drifts off the reference.
- Each slot now shows a small thumbnail of the source image being submitted, so it's visually obvious which reference is going to the model.
- Every video submission logs `{ model, faithful, image_url (truncated), prompt_chars }` to the DevTools console so you can verify the source image is being sent.

## 1.0.26 — Pop out for larger video preview
- Added a "⧉ Pop out" button in the header that opens the extension UI in a resizable standalone window, so the Image → Video player isn't squashed by Chrome's narrow side panel.
- Video players now use `object-fit: contain` with a 70vh cap, so the preview scales up cleanly in the popped-out window without distortion.

## 1.0.25 — Fix sidepanel video playback for signed/cross-origin assets
- The inline Image → Video player no longer forces `crossorigin="anonymous"`, which was causing otherwise valid remote MP4s to fail on hosts that do not return CORS headers for media.
- Added a blob playback fallback: when a slot finishes with a signed or CDN video URL, the extension now fetches the file first and plays a local blob URL if direct playback fails (or if the URL looks like a signed asset URL).
- Re-generating a slot now clears the previous playback URL/result first so stale "Ready" previews do not stick around while a new job is running.

## 1.0.24 — True video understanding for the Reference Video flow (server-backed)
- The Reference Video analyzer now calls a new ReadyCode edge function `imagekit-analyze-video` for YouTube + Shorts URLs. The server forwards the URL to Google Gemini with native video ingestion, so the storyboard reflects actual pacing, shot language, captions and audio cues instead of just the title + uploader.
- Graceful fallback: if the new endpoint isn't deployed yet, returns `{ fallback: "text_only" }`, or fails for any reason, the extension silently drops back to the existing metadata-only rewriter. TikTok and unknown platforms always use the rewriter path (Gemini doesn't ingest TikTok URLs).
- The 8–15s duration contract, clamp, and retry behaviour are unchanged — they run on the analyzer's output too.
- Annotation panel now records `__meta.source = "gemini-video" | "text-rewriter"` so you can tell which path produced the storyboard.
- No new permissions, no UI changes. Requires the ReadyCode lovable project to ship the `imagekit-analyze-video` edge function (see plan).

## 1.0.23 — Reference Video → Product Ad (8–15s)
- New block on the Video tab: paste a YouTube / TikTok / Shorts URL, pick a style mode (Safe Original / Closer Match / Prompt Only), and the extension fetches public oEmbed metadata + asks your AI provider to condense the reference into a brand-safe 8–15s storyboard.
- Hard duration rule enforced client-side: total 8–15s, each slot 3–7s. If the model returns out-of-range, the rewriter is re-called once with a "fit 8–15s" directive; if still off, the storyboard is auto-trimmed and a yellow warning is surfaced.
- Auto-fills the master prompt + all 3 slot prompts with explicit per-slot duration phrasing ("Create a 5-second image-to-video clip…") and clamps each duration to the slot model's bounds.
- Full annotation panel renders the structured analysis with **Download .json** and **Download .md** buttons so the long-form research is kept even though slot prompts stay tight.
- Brand-safe system prompt strips named people, faces, logos, copyrighted music, verbatim script, and distinctive set pieces; keeps pacing, shot types, lighting, framing, emotional arc, CTA pattern, palette feel.
- Added `host_permissions` for `youtube.com` and `tiktok.com` to allow oEmbed metadata fetches from the side panel.

## 1.0.22 — Wire the player to whatever URL field the backend returns
- Ready ✓ no longer leaves the `<video>` blank. Status responses are walked for the finished URL across all common shapes: `video_url`, `url`, `output_url`, `download_url`, `signed_url`, `unsigned_urls[]`, `assets[].url`, `output.url`, `outputs[]`, `videos[]`, `data.url`, `response.url`, etc.
- The same extractor runs on the sync-path generate response, so providers that finish in one call also bind correctly.
- Full terminal payload is now logged to the console (`[imagekit-video-status] ... terminal payload:`) so we can confirm which field carried the URL. If the backend reports terminal/ready but no plausible URL is present, the slot now flips to Failed with a clear message instead of silently showing an empty player.

## 1.0.21 — Recover provider/model identity on stale video polls
- Hardened `imagekit-video-status` polling so queued jobs always send `provider_id` + `model_slug`, even for slots created before those fields were cached locally.
- Video polling now stores the request `provider_id` at submit time and falls back to the matching OpenRouter/fal BYOK provider automatically instead of depending on the currently selected dropdown item.

## 1.0.20 — Video "Polish with AI" actually rewrites the prompt
- Rebuilt the Image → Video polish flow with a full motion-director rubric (Subject → Motion → Camera → Environment → Style → Timing → Audio → Negatives) tuned for Veo, Sora, Grok Imagine, Kling, Luma, PixVerse, Hailuo, and Wan.
- Directives are now embedded inline in the user prompt, so the backend's handling of `system`/`style` no longer matters — the model always sees the full rubric, target models, target duration, and audio-capability flag.
- Surfaces empty/failed responses instead of silently doing nothing; strips stray code fences/quotes from output; blocks polish until a provider key is selected.

## 1.0.19 — Echo job identity on status polls
- `imagekit-video-status` POST now echoes back the snake_case `provider`, `provider_id`, `model_slug`, `status_url`, and `response_url` returned by the generate response. Without these the backend rejected every poll with 400 and the slot hung on Queued forever (OpenRouter was never polled).

## 1.0.18 — OpenRouter videos use the dedicated /videos API (server-side)
- Backend now calls OpenRouter's async `POST /api/v1/videos` + `GET /api/v1/videos/{id}` endpoints instead of `/v1/chat/completions` for video slugs. Image-to-video sends the source as `frame_images[{ frame_type: "first_frame" }]`.
- Fixes "OpenRouter has no model at x-ai/grok-imagine-video" — the slug was always valid; we were hitting the wrong endpoint.
- Status normalised: `pending`/`processing` → `queued`/`in_progress`, `completed` returns `unsigned_urls[0]`. Extension's poll loop is unchanged.

## 1.0.17 — Auto-fallback to OpenRouter for fal-ai slugs (server-side)
- Backend now transparently reroutes `fal-ai/*` video slugs to their OpenRouter equivalent when no fal.ai key is configured but an OpenRouter key is. No extension changes required — pick any fal slug and it will run on whichever key you have.
- Returns a clear error only when neither key can service the slug.

## 1.0.16 — Dual-provider Image → Video (fal.ai + OpenRouter)
- **Backend wired up.** The Image → Video tab now talks to the new `imagekit-video-generate` / `imagekit-video-status` / `imagekit-save` endpoints.
- **Two providers, one tab.** Each slot's model dropdown is grouped under **fal.ai** and **OpenRouter** optgroups; the backend routes by slug prefix — `fal-ai/*` uses your fal.ai BYOK key, anything else uses your OpenRouter BYOK key. Add either or both.
- **Default slots:** Veo 3 (fal), Kling 2.1 Std (fal), Grok Imagine (OpenRouter).
- **Slot badge:** every slot card shows a small `fal` or `OR` chip so you know which key will be billed.
- **Custom slug input** accepts both formats (`fal-ai/veo3/image-to-video` or `x-ai/grok-imagine-video`) and auto-detects the provider.
- **Field alignment:** sends `duration_seconds` / `model_slug` to match the backend contract; `imagekit-save` now sends top-level `duration_seconds` plus `provider` / `model_slug` in `source_metadata`.
- **Better progress UI:** recognises the backend's `queued | in_progress | completed | failed` vocabulary, displays `In queue (#N)…` when fal.ai reports a queue position, falls back to the last log line when progress % isn't available.
- **BYOK notice** added to the top of the Video tab so users know exactly which key powers which slug.

## 1.0.15 — Brighter toolbar icon
- Replaced the dark black/red icon with a bright orange→pink→purple gradient picture/sparkle mark so it's easy to see on both light and dark Chrome toolbars.

## 1.0.14 — Image → Video tab
- **New "Image → Video" tab** with up to **3 parallel model variants** per source image.
- **Source widget** mirrors Respin/UGC: upload, paste URL, Grab visible tab, Pick from Library. Right-click → *Grab this image* now routes here if the Video tab is the active tab.
- **Cross-tab "→ Video" buttons:**
  - Respin output: new **→ Video** button next to Download / Save.
  - UGC: per-shot **→ Video** button on every ready shot card, plus **→ Video (selected)** in the top + bottom bulk toolbars.
  - Library: every asset card now has a **→ Video** action alongside *Use as source* / *Add as reference*.
- **Default model slots** (curated from openrouter.ai/models?output_modalities=video):
  - Slot 1 — `x-ai/grok-imagine-video` (currently #1 on Arena image-to-video, 1–15s @ 24fps, 480p/720p, 7 aspect ratios, $0.05–0.07/sec).
  - Slot 2 — `google/veo-3.1-fast` (4–8s, 720p/1080p, native synced audio, $0.10/sec).
  - Slot 3 — `kwaivgi/kling-v3.0-std` (3–15s, 720p, first/last-frame control, $0.126/sec).
  - Custom OpenRouter slug field per slot. Built-in catalog also covers Veo 3.1 / Veo 3.1 Lite, Kling v3 Pro, MiniMax Hailuo 2.3, Alibaba Wan 2.6, OpenAI Sora 2 Pro.
- **Guided prompt editor** based on the Subject → Motion → Camera → Environment → Style → Timing → Audio structure from the [DeeVid Grok Imagine Video review](https://deevid.ai/blog/grok-imagine-video-review). Fill the 7 fields, hit **Compose from fields**, or paste a freeform master prompt.
- **✨ Polish with AI** rewrites the master via your BYOK text model into a production-ready video prompt: enforces the 7-part structure, inserts an explicit motion verb, and matches pacing language to the longest selected duration. Drops the audio line when no slot supports synced audio.
- **Per-slot controls:** duration slider clamped to the model's min/max, resolution toggle, aspect ratio chips, live cost estimate (`duration × $/sec`). "Audio supported" badge on Veo / Sora / Wan slots.
- **Async job handling:** each slot shows queued → rendering → ready, polling `imagekit-video-status` every 5s (12 min timeout) with progress %. Inline `<video>` preview + Download + Save to Library on completion.
- **Library album grouping:** all 3 variants of one source image share a `session_id` and album name (`I2V · 2026-05-26 14:32`) so the ReadyCode library can fold them together.
- **Requires the ReadyCode backend** to add:
  - `imagekit-video-generate` edge function — takes `{ provider_id, model, prompt, image_url, duration, resolution, aspect_ratio }`, returns either `{ video_url, mime_type, … }` (sync) or `{ job_id }` (async).
  - `imagekit-video-status` edge function — takes `{ job_id }`, returns `{ status, progress?, video_url?, mime_type?, error? }`.
  - `imagekit-save` extension — accept `video_url` (or `video_base64`) and `mime_type: video/mp4`, persist `album` + `session_id`.
  - `imagekit-enhance-prompt` extension — accept the new `style: "video_prompt"` mode (already passes a custom `system` prompt, no schema change needed).

## 1.0.13 — UGC bulk actions & library album
- **Save / Download stay available after approval.** Previously the buttons disappeared once you clicked Approve. Now every ready shot keeps its Save, Download, and Re-generate buttons (Save shows "Save again" after a successful save).
- **Toolbars at top + bottom of the chain** with: *Select all*, *Download selected*, *Save selected to library*, *Download all ready*, *Save all ready*. Each shot card has a Select checkbox in its header.
- **Library grouping.** Each prompt pack now gets a session id and album name (e.g. `UGC · person · 2026-05-26 14:32`). The `imagekit-save` call sends `album`, `session_id`, and the same fields inside `source_metadata` so the ReadyCode library can render saved UGC shots together under one folder. *Requires the ReadyCode `imagekit-save` edge function to persist `album` / `session_id` on the library row (or read them from `source_metadata`) and group by album in the library UI.*

## 1.0.12
- **Fixed Grok Imagine slug.** The correct OpenRouter id is `x-ai/grok-imagine-image-quality` (xAI's fast high-fidelity image model, 1K/2K, supports reference images). The old `x-ai/grok-imagine` slug doesn't exist on OpenRouter and silently fell back to a Gemini default. Grok Imagine is back as a preset.

## 1.0.11
- **Fixed silent fallback to Gemini in UGC model picker.** The "Grok Imagine" preset sent `x-ai/grok-imagine`, which doesn't exist on OpenRouter — OpenRouter silently routed those requests to a default Gemini image model. Grok Imagine is not currently exposed by OpenRouter (only via xAI's own API), so the preset has been removed. Replaced with **GPT‑5 Image** and **GPT‑5.4 Image 2** presets alongside the two Gemini options — all four are verified against `openrouter.ai/api/v1/models`. The custom model id field still accepts any valid OpenRouter slug.

## 1.0.10
- UGC tab now shows **"Next shot will use: {provider} → {model}"** under the model picker so you can verify before generating. If you pick Grok / custom model but your Respin provider isn't an OpenRouter key, a red warning explains why the override is ignored (the BYOK backend only honors the model id for OpenRouter providers).

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
