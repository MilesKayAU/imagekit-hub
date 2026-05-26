# Reference Video → Product Ad — full status & connection plan

## 1. What's already shipped in this repo (extension v1.0.23)

All in `extension/sidepanel.html` + `extension/sidepanel.js`:

- **UI** in the Video tab: URL input, style mode (`Safe Original` / `Closer Style Match` / `Prompt Only`), Analyze button, collapsible annotation panel, Download JSON / Markdown buttons.
- **`rvParseUrl()`** — recognises YouTube, youtu.be, YouTube Shorts, TikTok.
- **`rvFetchMeta()`** — public oEmbed call for title + author + thumbnail (no auth, CORS-safe).
- **`RV_SYSTEM` rubric** — hard 8–15s contract, beat map (0-2 hook / 2-5 reveal / 5-10 benefit / 10-15 CTA), brand-safe strip-list (no faces, logos, music, taglines, set pieces), strict JSON schema.
- **`rvCallRewriter()`** — currently calls the existing `imagekit-enhance-prompt` edge function as a pure text rewriter.
- **`rvClampTo15()` + `rvSumDuration()`** — validates total seconds; one retry; then hard-clamps slots to 3–7s each and 8–15s total.
- **`rvApplyStoryboard()`** — fills `vp-master` and the 3 video slots with per-slot `"Create an Xs image-to-video clip…"` prompts.
- **Manifest 1.0.23** — `host_permissions` for youtube.com + tiktok.com (needed for oEmbed).
- **Generate path** — unchanged. Slots use existing `imagekit-video-generate` + `imagekit-video-status`. The 1.0.22 `extractVideoUrl()` fix already wires the finished video into the `<video>` tag.

### What this means today
End-to-end **works**, but the "analysis" is inferred from URL + title + uploader only. The model never actually sees the video. That's the gap.

---

## 2. The gap: real video understanding

To make the annotation match the reference video itself (pacing, shots, captions, palette, audio cues), we need a model that natively ingests the YouTube URL. Best fit: **Google Gemini 2.x** (`gemini-2.5-flash` or `pro`) which accepts a `file_data` part with `file_uri: <youtube url>` and returns analysis without us downloading the video.

The extension cannot call Gemini directly (API key must stay server-side). So this needs **one new edge function in the ReadyCode lovable project**.

---

## 3. What the ReadyCode lovable project needs to add

### 3a. New Supabase edge function: `imagekit-analyze-video`

Location: same folder as the other `imagekit-*` functions.

**Auth & gating** — identical to `imagekit-enhance-prompt`:
- Require `Authorization: Bearer <user_jwt>` + `apikey` (Supabase anon).
- Look up the caller, enforce the same per-user rate limit / credit deduction policy used by other AI calls.
- Read the Google API key from `GOOGLE_GEMINI_API_KEY` secret (add via Supabase secrets if not already present).

**Request body:**
```json
{
  "url": "https://www.youtube.com/watch?v=…",
  "platform": "youtube|shorts|tiktok|unknown",
  "mode": "safe|closer|prompt_only",
  "audio_capable_target": true,
  "system": "<RV_SYSTEM string sent from extension>",
  "directive": "<the same directive text the extension already builds>"
}
```
The extension already builds `system` + `directive`. The edge function just forwards them so the rubric and 8–15s contract stay owned by the extension.

**Provider routing:**
- If `platform` is `youtube` or `shorts` → call Gemini `generateContent` with:
  ```jsonc
  {
    "contents": [{
      "role": "user",
      "parts": [
        { "file_data": { "file_uri": "<url>", "mime_type": "video/*" } },
        { "text": "<directive>" }
      ]
    }],
    "system_instruction": { "parts": [{ "text": "<system>" }] },
    "generationConfig": { "responseMimeType": "application/json", "temperature": 0.4 }
  }
  ```
  Model: `gemini-2.5-flash` (cheap, plenty good for ad structure). Fall back to `gemini-2.5-pro` on 5xx.
- If `platform` is `tiktok` or `unknown` → Gemini does NOT ingest TikTok URLs. Return a 200 with `{ "fallback": "text_only" }` so the extension uses its current text-rewriter path. (Phase 2 could add a TikTok scraper, out of scope.)

**Response (success):**
```json
{
  "analysis": { /* the JSON object matching RV_SYSTEM's schema */ },
  "provider": "gemini-2.5-flash",
  "tokens": { "input": 1234, "output": 567 }
}
```

**Response (validation failure):** mirror `imagekit-enhance-prompt`'s error shape: `{ "error": "…" }` with the right HTTP status. Do NOT throw raw Gemini errors back — wrap them.

**CORS:** allow the extension origin pattern already used by the other functions (the extension uses `chrome-extension://…` — current functions already accept this).

**No DB schema changes needed.** No new tables. No new RLS.

### 3b. Secret to add (one-time)
`GOOGLE_GEMINI_API_KEY` in Supabase → Edge Functions → Secrets. The ReadyCode side already has the Gemini SDK pattern in `imagekit-enhance-prompt` (it routes through providers); if a Gemini provider row already exists for `ai-providers`, the function can reuse that key lookup instead of a dedicated secret.

### 3c. Nothing else
- No web UI changes on the ReadyCode lovable site.
- No changes to `imagekit-video-generate`, `imagekit-video-status`, `imagekit-save`, `imagekit-generate`, or `ai-providers`.
- No changes to billing rows beyond whatever credit cost they want to bill per `imagekit-analyze-video` call.

---

## 4. What I'll change in this extension repo once that endpoint exists

Small, surgical edit in `extension/sidepanel.js`:

1. New `rvCallAnalyzer(parsed, directive, mode)` that POSTs to `imagekit-analyze-video` via the existing `api()` helper.
2. In `rvAnalyze()`: if `parsed.platform` is `youtube` or `shorts` → call the analyzer first. On `{ fallback: "text_only" }` or any non-2xx → fall back to the current `rvCallRewriter` path. TikTok continues using the text path.
3. Re-use existing `rvClampTo15` / `rvSumDuration` validation unchanged.
4. Bump manifest to `1.0.24` + CHANGELOG entry.

No UI changes. No new permissions (the call is to Supabase, already allowed).

---

## 5. Handoff checklist for the ReadyCode lovable agent

Paste this to the other Lovable:

> Add a new Supabase edge function `imagekit-analyze-video` with the same auth gating as `imagekit-enhance-prompt`. It accepts `{ url, platform, mode, audio_capable_target, system, directive }`, forwards `system` + `directive` to Gemini 2.5 Flash with `file_data.file_uri = url` + `responseMimeType: "application/json"`, and returns `{ analysis, provider, tokens }`. For TikTok or unknown platforms return `{ "fallback": "text_only" }`. Add `GOOGLE_GEMINI_API_KEY` secret (or reuse the existing Gemini provider key in `ai-providers`). No UI, no schema, no other function changes.

---

## 6. Out of scope (still)
- Auto-pulling the product image from the current tab (separate feature).
- TikTok native ingestion (Gemini doesn't support it).
- Music / stitching / saving the assembled ad as a single asset.
