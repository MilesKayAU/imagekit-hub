## Goal
Image → Video tab supports **both** fal.ai and OpenRouter as video providers. The extension sends the model slug; backend routes by prefix (`fal-ai/*` → fal, anything else → OpenRouter). Customer uses whichever BYOK key they already have.

## Changes — extension only (`extension/`)

### 1. `VIDEO_MODELS` catalog (sidepanel.js)
Rebuild as a single map, each entry tagged with `provider: 'fal' | 'openrouter'`. Curated set:

**fal.ai**
- `fal-ai/veo3/image-to-video` — Veo 3 (audio, 8s, 720p/1080p, 16:9 / 9:16)
- `fal-ai/veo3/fast/image-to-video` — Veo 3 Fast (cheaper)
- `fal-ai/kling-video/v2.1/standard/image-to-video` — Kling 2.1 Std (5/10s)
- `fal-ai/kling-video/v2.1/pro/image-to-video` — Kling 2.1 Pro
- `fal-ai/minimax/hailuo-02/standard/image-to-video` — Hailuo-02 (6/10s)
- `fal-ai/luma-dream-machine/ray-2/image-to-video` — Luma Ray 2
- `fal-ai/pixverse/v4.5/image-to-video` — PixVerse 4.5
- `fal-ai/wan-pro/image-to-video` — Wan Pro

**OpenRouter**
- `x-ai/grok-imagine-video` — Grok Imagine (1–15s, 480p/720p)
- `google/veo-3.1-fast` — Veo 3.1 Fast (audio)
- `google/veo-3.1` — Veo 3.1
- `kwaivgi/kling-v3.0-std` — Kling v3 Std
- `minimax/hailuo-2.3` — Hailuo 2.3
- `alibaba/wan-2.6` — Wan 2.6
- `openai/sora-2-pro` — Sora 2 Pro

Each entry keeps `{ label, provider, durMin, durMax, durDefault, resolutions, aspects, audio, pricePerSec }`.

### 2. Slot UI
- Model dropdown groups options under **fal.ai** and **OpenRouter** optgroups so the source is obvious.
- Each slot card shows a small `fal` or `OR` badge next to the model name.
- Custom slug field accepts either format; auto-detect provider from prefix.
- Default slots: Veo 3 (fal), Kling 2.1 Std (fal), Grok Imagine (OpenRouter) — gives the user one of each big family.

### 3. Provider key notice (top of Video tab)
> Image-to-video uses your BYOK key from ReadyCode → AI Providers. `fal-ai/*` models bill your **fal.ai** key (`https://fal.run`); all other slugs bill your **OpenRouter** key. Add either or both — pick the model that matches the key you have.

### 4. Request/response field alignment
- `generateVideoSlot()` → rename `duration` → `duration_seconds`. Pass `model_slug` (backend uses prefix to route). Capture `provider`, `provider_id`, `model_slug`, `status_url`, `response_url` from the response onto the slot.
- `pollVideoJob()` → recognise the backend's vocabulary: `queued | in_progress | completed | failed`. Show `queue_position` when present (`In queue (#3)…`), `progress %` otherwise. Keep legacy `succeeded` as fallback.
- `saveVideoSlot()` → send top-level `duration_seconds` alongside the existing `video_url`, `mime_type`, `kind:"video"`, `album`, `session_id`, `source_metadata`.

### 5. Version + changelog
- `extension/manifest.json` → `1.0.16`
- `extension/CHANGELOG.md` → entry covering: dual-provider routing, fal.ai + OpenRouter catalogs, field-name fixes (`duration_seconds`), in-queue progress UI, key-source notice.
- Repackage `public/readycode-imagekit-oss.zip`.

## Out of scope
- No web app / `src/` changes.
- No other tab changes.

## Message to paste into the backend project
> Please make `imagekit-video-generate` / `imagekit-video-status` route by **`model_slug` prefix**:
> - `fal-ai/*` → existing fal.ai queue branch (uses user's fal BYOK key).
> - Anything else (e.g. `x-ai/*`, `google/*`, `kwaivgi/*`, `minimax/*`, `alibaba/*`, `openai/*`) → OpenRouter video API branch using the user's OpenRouter BYOK key.
> Normalize both into the same `{ status: queued|in_progress|completed|failed, progress, queue_position, video_url, mime_type, logs }` shape. Return `provider: 'fal' | 'openrouter'` in the generate response so the extension can show it.
