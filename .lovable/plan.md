## Goal

Make the Respin result iterable and let users mix in their saved Library images as additional inputs — so they can refine a generated image with more direction, or combine a generated image with a saved ingredient/product shot to produce a new result. All inference still goes through the existing `imagekit-generate` edge function (which already accepts an `images: []` array), so the readycode.ai backend needs only one small change.

## 1. Extension — Refine box on Respin result

**`extension/sidepanel.html`** — inside `#output`, below the `<img>` and the Download/Save row, add a "Refine" block:
- Textarea: "Tell the AI what to change — e.g. 'warmer lighting, add a wooden tray under it'."
- Row of buttons: **Refine** (primary), **Use as source** (secondary — pushes the current result back into step 1 as the new source), **Start over** (secondary — clears result).

**`extension/sidepanel.js`**
- New `refineCurrent()`: takes the current `state.result` (data URL of the just-generated image), the refine textarea text, and any extras picked from the library (see §2). Calls the existing `imagekit-generate` endpoint with `images: [resultDataUrl, ...extras]`, `prompt: <refine text>`, `mode: "refine"`, same `provider_id` + `model` as the previous run. On success, replaces `state.result` and the displayed image; the refine box stays open so the user can iterate again. Each refine round shows the previous prompt as muted helper text so the user can see what was built on.
- Wire **Use as source** → `setSource({ url: dataUrl, dataUrl })` and clear `#output`.
- The existing **Save to Library** button continues to save whatever is currently shown.

## 2. Extension — "From Library" picker for source + extras

**Respin tab (`sidepanel.html`)** — under step 1 (Source image) add a third row:
- Button **Pick from Library** → opens a new `<dialog id="lib-picker">`.
- New block under step 1 labelled "Extra reference images (optional)" with a thumbnail strip + "Add from Library" button + "Add upload" file input. Caption: "Combine multiple images — e.g. add an ingredient shot to a scene and tell the AI how to merge them."

**Library tab (`sidepanel.html` / `.js`)** — each library card gains two hover buttons:
- **Use as source** — sets it as the Respin source and switches to the Respin tab.
- **Add as reference** — appends it to the extras strip on Respin.

**`#lib-picker` dialog (`sidepanel.js`)** — reuses the same fetch + signed-URL logic already in `renderLibrary()`, but renders into the dialog and supports a target (`"source"` or `"extra"`) so the same picker serves both the source button and the extras button. On pick, it stores the signed URL in `state.sourceUrl` / `state.extras[]`.

**State changes**
- `state.extras: string[]` (signed URLs from library or data URLs from uploads).
- Generate + Refine both send `images: [primary, ...state.extras]` to `imagekit-generate`.
- Extras strip shows thumbnails with an × to remove individually; cleared on Start over.

**`extension/sidepanel.css`** — small styles for the refine block, extras strip, and library card hover actions. No new tokens.

**`extension/manifest.json`** — bump `version` `1.0.2` → `1.0.3`.
**`extension/CHANGELOG.md`** — one-line entry covering refine + library-as-source + multi-image references.

## 3. Install page

**`src/routes/install.tsx`** — append two bullets to the "What it does" list: "Refine any result with follow-up instructions" and "Pull saved Library images in as references — combine a product shot with an ingredient, etc."

## 4. Readycode.ai side — minimal backend change

Only one thing is needed on the main project; bundle this as a copy-paste prompt for that Lovable project:

> **Prompt for the readycode.ai Lovable project:**
> The ImageKit Chrome extension now sends multi-image requests to the existing `imagekit-generate` edge function — a generated image plus optional library/upload references — for both first-pass generation and follow-up "refine" rounds. Please make sure `imagekit-generate`:
> 1. Accepts an `images: string[]` array of length 1–4 (already does for 1; extend to up to 4). Each entry can be a public URL, a Supabase Storage signed URL on the `imagekit-library` bucket, or a `data:` URL.
> 2. Forwards all of them to the BYOK provider in the order received as multi-image input (OpenRouter image-capable models, Gemini `gemini-3.1-flash-image-preview`, and GPT-Image already support multi-image input — map accordingly per provider).
> 3. Accepts a new `mode: "refine"` value alongside the existing modes; treat it identically to `lifestyle` for provider routing, but pass the user's refine prompt verbatim with a short system preamble like "Edit the first image according to the instructions, using any additional images as references."
> 4. Keeps the existing per-user rate limit and BYOK key resolution unchanged.
> No schema changes, no new tables, no new endpoints. The Library bucket and `imagekit_assets` table the extension already reads from are unchanged.

## Out of scope

- No new edge functions, tables, RLS, or storage buckets.
- No deep-link/postMessage flow.
- No changes to auth, BYOK UI, or the connect page.
- No version bump on readycode.ai (backend-only tweak inside the existing edge function).

## Verification

- Generate an image → refine box appears under result → typing "make it warmer" + Refine produces a new image in place; Save still saves the latest one.
- "Use as source" pushes the result into step 1 and clears the output.
- Library tab → "Use as source" on any saved card jumps to Respin with that image loaded.
- Respin → "Add from Library" → pick 1–2 cards → thumbnails show in extras strip → Generate sends all images; result reflects the combination.
- `manifest.json` shows `1.0.3`; install page lists the two new bullets.
