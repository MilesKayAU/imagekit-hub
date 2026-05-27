# `imagekit-analyze-video`

**Deploy target:** the **ReadyCode** Lovable project (same Supabase project that
already hosts `imagekit-enhance-prompt` and `imagekit-video-generate`). This
repo is the source of the Chrome extension only and has no Cloud backend of
its own — this folder is a reference implementation you paste into the
ReadyCode site project under `supabase/functions/imagekit-analyze-video/`.

## What it does

Calls Gemini directly with a YouTube / Shorts URL as a `fileData` part and
asks it to produce the same JSON shape the extension already consumes from
`imagekit-enhance-prompt` (`slot_prompts[]` with per-shot `image_prompt`,
`video_prompt`, `duration_s`, etc. — see `RV_SYSTEM` in the extension).

## Contract (must stay stable)

Request body:

```json
{
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
{ "analysis": { ...same shape as RV_SYSTEM JSON... } }
```

Fallback signal (extension switches to `imagekit-enhance-prompt`):

```json
{ "fallback": "text_only", "reason": "tiktok not ingestable by gemini" }
```

Any non-2xx or thrown error also triggers the extension's fallback path, so
ship-blocking failures here never block the Video Marketing feature.

## Env

- `LOVABLE_API_KEY` (already provisioned on the ReadyCode project).

## Model

`google/gemini-2.5-pro` via the Lovable AI Gateway. Gemini supports
`fileData` parts pointing at public YouTube URLs natively.