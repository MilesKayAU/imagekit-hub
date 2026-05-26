
## New "Image → Video" tab

Adds a 5th tab in the side panel that animates any still (UGC shot, Respin result, library image, upload, URL, or right-click grab) into up to 3 short clips in parallel using different OpenRouter video models.

### Model picks (researched on openrouter.ai/models?output_modalities=video)

| Slot | Default model | Duration | Resolutions | Price | Why |
| --- | --- | --- | --- | --- | --- |
| 1 | `x-ai/grok-imagine-video` | 1–15s @ 24fps | 480p / 720p | $0.05 / $0.07 per sec | Currently #1 on Arena image-to-video leaderboard. Best instruction following. |
| 2 | `google/veo-3.1-fast` | 4–8s | 720p / 1080p | $0.10 per sec | Native synced audio, top-tier visual quality. |
| 3 | `kwaivgi/kling-v3.0-std` | 3–15s | up to 1080p | $0.126 per sec | First/last-frame control, strong cinematic motion. |

Each slot has its own model picker (presets above + free-text OpenRouter slug field, same pattern as UGC v1.0.12). Honorable mentions in the custom-slug help text: `minimax/hailuo-2.3` ($0.08/s, realistic motion), `alibaba/wan-2.6` ($0.04/s, cheapest), `openai/sora-2-pro` ($0.30/s, premium).

### Source image — one source feeds all 3 slots

Source widget reuses the existing pattern: drag/upload, paste URL, "Grab visible tab", "Pick from Library", and right-click context-menu grab routes here when this tab is active (extending the v1.0.9 active-tab routing).

Two new "Send to Video" buttons added elsewhere:
- **Respin tab** — under the output image, "Send to Video".
- **UGC tab** — per shot card and as a new toolbar button "Send selected to Video" (uses the v1.0.13 checkbox selection).

Both hand the image (+ that shot's prompt as a starting point for slot 1) to the Image-to-Video tab and switch to it.

### Guided prompt editor (one master prompt, slot-specific overrides)

Master prompt area uses the Subject → Motion → Camera → Environment → Style → Timing → Audio structure from the DeeVid article, rendered as 7 short labeled inputs that get composed into the final prompt string. A "Polish with AI" button calls the existing `imagekit-enhance-prompt` BYOK text endpoint with a new `mode: "video_prompt"` system prompt that:
- enforces the 7-part structure
- inserts a single explicit motion verb (rotate, dolly-in, pan-left, etc.)
- tunes pacing language to fit the selected duration (e.g. "slow 12s reveal" vs "snappy 5s loop")
- adds audio-intent line only when slot model supports synced audio (Veo, Sora)

Each slot can override the master prompt before generating (same pattern as UGC shot cards).

### Per-slot controls

- Duration slider (clamped to model's min/max — Grok 1–15, Veo 4–8, Kling 3–15)
- Aspect ratio chips (slot 1 supports 7 ratios, others 3)
- Resolution toggle (480p / 720p / 1080p, model-dependent)
- Live cost estimate: `duration × $/sec` shown under the slot
- "Generate" button per slot + "Generate all 3" toolbar button

### Async job handling

Video generation takes minutes, not seconds. Each slot card shows a progress state (queued → rendering → ready) and polls until done. When ready: inline `<video>` preview, Download, Save to Library, and "Re-generate with this prompt".

### Library grouping

Saved videos use `kind: "video"`, `album: "I2V · <source name> · <timestamp>"`, and `session_id` so the library can group all 3 model variants of one source image together (extends the v1.0.13 album pattern).

### Files to change

- `extension/sidepanel.html` — add 5th tab markup, 3 slot cards, structured prompt grid
- `extension/sidepanel.css` — `.video-slot-card`, `.video-progress`, cost pill
- `extension/sidepanel.js` — `video` module (state, slot defaults, polling, send-to-video hooks, prompt composer); patch `consumePending` to also route grabs to video tab; patch UGC chain to add "Send to Video" per shot + toolbar
- `extension/manifest.json` + `CHANGELOG.md` — bump to v1.0.14

### ReadyCode backend work required (separate repo, called out — not in this plan's diff)

1. New edge function `imagekit-video-generate` that:
   - takes `{ provider_id, model, prompt, image_url, duration, resolution, aspect_ratio }`
   - calls OpenRouter's video endpoint with the user's BYOK key
   - returns a job id; supports polling endpoint `imagekit-video-status?job_id=...`
2. Extend `imagekit-save` to accept `video_base64` / `video_url` and `mime_type: video/mp4`, persist `album` + `session_id`.
3. Extend `imagekit-enhance-prompt` to accept `mode: "video_prompt"` with the structured-prompt system message.

### Out of scope

- Video-to-video editing (Grok supports it; defer to a later tab)
- Audio extraction / dubbing
- Multi-shot stitching across slots
- Auto-publishing to social platforms
