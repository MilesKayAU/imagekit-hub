## UGC tab — guided multi-shot generator

A new **UGC** tab in the Chrome extension. The user uploads/grabs any subject (product, food, place, person), writes a single master prompt (shot 1), and the extension generates a chained pack of 6 consistent shots step-by-step. Each shot is approved before the next is generated, and shot N≥2 uses shot N−1's output as a reference image so identity/outfit/scene stay locked. Powered entirely by the user's BYOK provider — ReadyCode never bills for inference.

---

### User flow

1. Open UGC tab → pick subject (Person / Product / Food / Place — drives the default prompt pack template).
2. Drop or grab a source image (same source widget as Respin: URL, upload, "Grab visible tab", "Pick from Library").
3. **Model picker at top of tab** — recommends `x-ai/grok-imagine` and `google/gemini-3-pro-image-preview` for photoreal humans; user can swap to anything from the existing OpenRouter catalog or paste a custom slug. Falls back to whatever BYOK provider they have if not OpenRouter.
4. **Shot 1 (master)** — pre-filled with a category template (e.g. for Person: the full-body composition prompt from the user's example). User edits freely.
5. Click **Generate pack** → text call to BYOK rewrites prompts 2–6 to stay consistent with the master (same subject/outfit/lighting/style, varied pose/scene/angle). The 5 follow-up prompts appear in editable cards below.
6. Click **Generate shot 1** → renders. User sees result, can **Refine** (reuses existing refine box) or **Approve & continue**.
7. On approve, **shot 2** auto-fires using shot 1's image as the reference (plus the original source) and the AI-written prompt 2. Repeat through shot 6.
8. At any point, editing the master prompt triggers a re-sync of the unrendered follow-up prompts (one BYOK text call).
9. Each completed shot has Download / Save to Library buttons (reuses library code).

---

### Default prompt packs (shipped in extension code)

Four category templates, each a 6-shot chain. Example for **Person/UGC fashion** (matches the user's example):

```text
1. Full body composition, photorealistic portrait of a 25-year-old woman with long hair, natural realistic skin with visible pores and skin texture, streetwear vibe, wearing this exact black t-shirt with the precise white graphic logo from the reference image, fitted not oversized, black pants and all-black shoes, standing in confident pose with hand on hip, plain white seamless background, natural studio lighting, ultra realistic, high resolution, detailed
2. Same subject, three-quarter pose, mid-shot, soft window light
3. Same subject in an outdoor lifestyle scene (urban sidewalk, golden hour)
4. Mirror selfie, phone visible, casual bedroom interior
5. Action shot — walking, motion blur in background
6. Close-up portrait, shallow depth of field, expressive
```

Product / Food / Place ship with their own 6-shot baselines (hero, lifestyle, in-use, scale reference, detail macro, alt angle).

---

### Files to change

**Extension (this repo):**
- `extension/sidepanel.html` — add 4th tab `UGC` and a new `<section id="tab-ugc">` panel with: subject-type chips, source widget (cloned markup), model picker (cloned from Respin), master prompt textarea, "Generate pack" button, then a vertical list of 5 shot cards (prompt textarea + Generate/Refine/Approve buttons + result image + meta).
- `extension/sidepanel.css` — `.ugc-shot-card`, `.ugc-chain`, status states (pending / generating / done / approved).
- `extension/sidepanel.js` — new `ugc` module:
  - `state.ugc = { subjectType, sourceUrl, extras, masterPrompt, shots: [{prompt, status, result, refineHistory}] }`
  - `loadPromptPack(subjectType)` returns the default 6 prompts
  - `regenerateFollowUps()` calls the new ReadyCode endpoint with `{ mode: "ugc_chain", master, subjectType, count: 5 }` and replaces shots[1..5].prompt
  - `generateShot(i)` calls existing `imagekit-generate` with `image_urls = [source, ...extras, shots[i-1].result?.url]` (skip the prev-result ref on shot 1)
  - reuses `imagekit-refine` for per-shot refine
  - "Approve & continue" advances state and triggers next shot
- `extension/manifest.json` — bump to `1.0.7`.
- `extension/CHANGELOG.md` — 1.0.7 entry.

**ReadyCode project (separate repo — not edited from here):**
- Extend existing `imagekit-enhance-prompt` edge function with a new `mode: "ugc_chain"` that takes `{ master_prompt, subject_type, count }` and returns `{ prompts: [string × count] }` via the user's BYOK text model. System prompt instructs the model to preserve subject identity/outfit/lighting and only vary pose/scene/angle. Keeps the cron, BYOK billing, and security model identical to the existing enhance flow.
- No DB schema change.

---

### Technical notes

- Identity lock comes from passing the previous shot's output back in as a reference image on every subsequent call — the existing `imagekit-generate` already accepts an `image_urls[]` array (used today by Respin extras), so no backend change for generation itself.
- All BYOK calls (text and image) flow through existing ReadyCode edge functions — no new secrets, no published Lovable web app (respects the "never publish" core rule).
- Step-by-step + approve avoids burning BYOK credits on a bad chain; if shot 1 is wrong, user refines once, then the rest of the chain inherits the good shot.
- Model picker on the UGC tab reuses the v1.0.5 catalog + v1.0.6 custom-model-id input — no new picker code, just a second mount point.

---

### Out of scope (can follow later)

- Saving a UGC chain as a reusable "campaign" template.
- Auto-export as a zip / contact sheet.
- Background music / video conversion.
