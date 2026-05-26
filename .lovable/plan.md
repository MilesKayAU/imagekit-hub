
# Recommended Image Models — sortable, daily-refreshed

Goal: when a user has linked an OpenRouter BYOK key, the extension shows a curated, daily-refreshed list of image-capable models from `openrouter.ai/models?input_modalities=image`. User can sort by price, speed, or popularity, click one, and it becomes the model used for the next Generate / Refine.

This Lovable project is the extension source only (per memory, never publish it). All scraping, cron, and the public JSON endpoint live in the ReadyCode project. The extension only consumes the JSON.

---

## Part A — ReadyCode project (separate Lovable repo)

Hand this off as a single prompt to the ReadyCode project:

> Add a daily-refreshed catalog of image-generation models sourced from OpenRouter, exposed as a public JSON endpoint that the ImageKit Chrome extension can read.
>
> **1. Schema (new migration):**
> ```sql
> create table public.imagekit_model_catalog (
>   id text primary key,                 -- openrouter model id, e.g. "google/gemini-2.5-flash-image"
>   name text not null,
>   provider text not null,              -- "google", "openai", "black-forest-labs", ...
>   description text,
>   context_length int,
>   pricing_prompt numeric,              -- USD per 1M input tokens
>   pricing_completion numeric,          -- USD per 1M output tokens
>   pricing_image numeric,               -- USD per image when available
>   output_modalities text[] not null,   -- must contain 'image'
>   input_modalities text[] not null,
>   weekly_tokens bigint,                -- popularity signal
>   median_latency_ms int,               -- speed signal
>   throughput_tps numeric,              -- speed signal (tokens/sec)
>   created_at_openrouter timestamptz,   -- model release date for "recency"
>   raw jsonb not null,                  -- full OpenRouter row, for forward-compat
>   refreshed_at timestamptz not null default now()
> );
> alter table public.imagekit_model_catalog enable row level security;
> create policy "public read" on public.imagekit_model_catalog for select to anon, authenticated using (true);
> ```
> No write policy — only the cron edge function writes (service role).
>
> **2. Edge function `imagekit-refresh-models`:**
> - Fetches `https://openrouter.ai/api/v1/models` (and, if available, the `/api/frontend/models` endpoint that exposes weekly token + latency stats — fall back gracefully if it changes).
> - Filters to models where `architecture.output_modalities` includes `image`.
> - Upserts each row into `imagekit_model_catalog`. Deletes rows not seen in the latest fetch (so retired models drop off).
> - Returns `{ count, refreshed_at }`.
>
> **3. pg_cron job (daily 03:00 UTC):**
> ```sql
> select cron.schedule(
>   'imagekit-refresh-models-daily',
>   '0 3 * * *',
>   $$ select net.http_post(
>        url := 'https://<project-ref>.supabase.co/functions/v1/imagekit-refresh-models',
>        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
>      ); $$
> );
> ```
>
> **4. Public read endpoint (`/api/public/imagekit/models`):**
> - TanStack server route, no auth required, CORS open to the extension origin.
> - Returns `{ refreshed_at, models: [...] }` sorted by `weekly_tokens desc` by default.
> - Supports `?sort=price|speed|popularity` and `?limit=` query params.
> - Includes for each model: `id`, `name`, `provider`, `description`, `pricing_image`, `pricing_prompt`, `pricing_completion`, `median_latency_ms`, `throughput_tps`, `weekly_tokens`, `created_at_openrouter`.
> - Stable URL: `https://project--<project-id>.lovable.app/api/public/imagekit/models`.
>
> **5. Manual trigger:** include a one-off admin button on `/admin/imagekit` that calls `imagekit-refresh-models` so you can refresh on demand without waiting for cron.

The extension will call only the public endpoint in step 4.

---

## Part B — Extension changes (this repo)

### B1. New "Models" sub-section in the Respin tab

Under existing **3. Your AI**, add a collapsible **"Browse recommended models"** panel that appears only when the selected BYOK provider is OpenRouter (reuse `isOpenRouterProvider` in `sidepanel.js`).

Inside the panel:
- Header row with three sort buttons: **Popularity** (default), **Price**, **Speed**. Active button highlighted.
- Scrollable list (max-height ~320px) of model cards. Each card shows:
  - Model name + provider chip
  - One-line description (truncated)
  - Three stats: `$ / image` (or `$ / 1M tokens` fallback), `~Xs median`, `★ weekly rank`
  - A small "Use this" button
- Footer: `Updated <relative time> · Source: openrouter.ai` with a refresh icon (re-fetches the JSON, max once per minute).

Clicking "Use this":
- Sets a new `state.modelOverride` to the OpenRouter model id (e.g. `google/gemini-2.5-flash-image`).
- The model id is shown next to the provider hint: `Using google/gemini-2.5-flash-image · Clear`.
- `Clear` resets `state.modelOverride = null` and falls back to `imageModelForProvider(provider)` (existing `openrouter/auto` behavior).

Generate + Refine pass `model: state.modelOverride ?? imageModelForProvider(provider)` so existing routing is preserved when no override is set.

### B2. Data fetch

- New module-level constant `RC_API_BASE = "https://project--<project-id>.lovable.app"` (final value pasted in once the ReadyCode endpoint is live).
- New function `loadModelCatalog(sort)` → `fetch(\`${RC_API_BASE}/api/public/imagekit/models?sort=${sort}\`)`, cached in `chrome.storage.local` under `rc_imagekit_models_cache` with a 6h TTL.
- No auth header required (the endpoint is `/api/public/*`).

### B3. Manifest

Add `https://project--<project-id>.lovable.app/*` to `host_permissions` so the side panel can `fetch` the public endpoint. Bump `manifest.json` version to `1.0.5`.

### B4. Styling

Add to `sidepanel.css`:
- `.model-list { max-height: 320px; overflow-y: auto; ... }`
- `.model-card { display: flex; flex-direction: column; gap: 4px; padding: 8px; border: 1px solid #e5e5e5; border-radius: 6px; }`
- `.model-card.active { border-color: #4f46e5; background: #f6f5ff; }`
- `.sort-tabs { display: flex; gap: 4px; margin-bottom: 8px; }` + active state.

### B5. CHANGELOG

```
## 1.0.5 — Recommended models picker
- New "Browse recommended models" panel (visible when your BYOK provider is OpenRouter). Sortable by Popularity, Price, or Speed. Tap "Use this" to lock the next Generate/Refine to that specific model. List is refreshed daily by ReadyCode straight from openrouter.ai.
```

---

## Why this split

- The extension stays static (no scraping, no cron, no secrets) — fits the "never publish this Lovable project" rule.
- ReadyCode owns the data pipeline, cache, and is the only place that needs OpenRouter API access. Other ReadyCode features (BYOK setup page, library) can reuse the same `imagekit_model_catalog` table later.
- Daily cron + 6h client cache means at most one OpenRouter scrape/day and near-instant UX in the extension.

## Open items to confirm before build

- Final ReadyCode project URL to bake into `RC_API_BASE` (or use the stable `project--<id>.lovable.app` host).
- Whether to also expose this picker on the **Get Started** tab as a teaser for unlinked users (read-only). Default plan: no — only show after BYOK is linked, to avoid promising models they can't run yet.
