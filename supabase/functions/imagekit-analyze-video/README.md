# `imagekit-analyze-video` (BYOK ONLY)

**Deploy target:** the **ReadyCode** Lovable project (same Supabase project that
already hosts `imagekit-enhance-prompt` and `imagekit-video-generate`). This
repo is the source of the Chrome extension only; the file here is a reference
implementation you paste into the ReadyCode site project under
`supabase/functions/imagekit-analyze-video/`.

## What it does

BYOK-only. Resolves the caller's `provider_id` from `ai_providers`, then uses
THAT user's key (OpenRouter or Google AI Studio direct) to ask a video-capable
model to watch the YouTube / Shorts URL and emit the same JSON shape the
extension already consumes from `imagekit-enhance-prompt` (`slot_prompts[]`
with per-shot `image_prompt`, `video_prompt`, `duration_s`, etc.).

**ReadyCode never bills inference here.** Do not add a `LOVABLE_API_KEY`
fallback — the function must refuse rather than spend our credits.

## Contract (must stay stable)

Request body:

```json
{
  "provider_id": "uuid-of-ai_providers-row",
  "url": "https://www.youtube.com/watch?v=…",
  "platform": "youtube" | "shorts" | "tiktok" | "unknown",
  "mode": "safe" | "closer" | "prompt_only",
  "audio_capable_target": true,
  "system": "<RV_SYSTEM rubric forwarded by extension>",
  "directive": "<full prompt forwarded by extension>"
}
```

Success response (extension reads either `analysis` or top-level):

```json
{ "analysis": { ...same shape as RV_SYSTEM JSON... }, "provider_name": "…", "model_name": "…" }
```

Fallback signal (extension switches to `imagekit-enhance-prompt`):

```json
{ "fallback": "text_only", "reason": "tiktok not ingestable by gemini" }
```

Hard errors (400) — extension surfaces these to the user instead of falling
back silently, so they know to add/fix a key:

```json
{ "error": "Provider \"X\" can't watch videos. Use an OpenRouter key…" }
```

## Env

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (already provisioned).
- No `LOVABLE_API_KEY`. Intentional — see above.

## Supported BYOK providers

- **OpenRouter** — `endpoint_url` hostname ends with `openrouter.ai`. Default
  model `google/gemini-2.5-pro` (override per-provider via
  `ai_providers.model_name`).
- **Google AI Studio direct** — `endpoint_url` hostname is
  `generativelanguage.googleapis.com`. Default model `gemini-2.5-pro`.

Anything else returns a 400 telling the user to add an OpenRouter or Google
key at `readycode.ai/byok`.
