## Goal

Transform this repo's web app (currently a "DO NOT PUBLISH" warning page) into a small marketing subdomain at **imagekit.readycode.ai** that showcases the ReadyCode ImageKit Chrome extension, satisfies Chrome Web Store listing requirements (homepage + privacy URL), and matches ReadyCode's brand (warm cream background, near-black text, vivid orange accent).

The extension source (`extension/`) stays untouched. The web app does **not** import any extension code.

## Memory rule update

The current core rule says "NEVER publish this project." That has to change — the whole point now is to publish the marketing site. Update `mem://index.md`:

- Remove the "never publish" rule.
- Add: "Marketing site only. Never bundle anything from `extension/` into `src/`. Privacy and install pages must stay in sync with `extension/PRIVACY.md` and `extension/manifest.json`."

## Pages (3)

```text
/            Home — hero, what it does, how it works, install CTA, ReadyCode connection
/install     Step-by-step install (Web Store + manual from GitHub release), link readycode.ai
/privacy     Privacy policy mirroring extension/PRIVACY.md, with last-updated date
```

Each route is its own file under `src/routes/` with its own `head()` (title, description, og:title, og:description, canonical pointing to `https://imagekit.readycode.ai/...`). Add a shared header (logo + nav) and footer (GitHub link, Privacy, ReadyCode.ai) inside `src/routes/__root.tsx`.

## Home page sections

1. **Hero** — "ReadyCode ImageKit — AI image generation in your browser's side panel." Primary CTA "Install for Chrome", secondary "View on GitHub".
2. **What it does** — three cards: Generate · Respin · Save to Library.
3. **How it works** — 3-step strip: Install → Bring your own OpenRouter key (BYOK) → Connect ReadyCode account to save to your Library.
4. **Open source & free** — MIT license badge, "Free core, future paid tiers for advanced features" line, BYOK explained in one sentence.
5. **ReadyCode connection** — short block: "Connects to readycode.ai to store your generated images. Free today, freemium tiers coming." Link to readycode.ai.
6. **Final CTA** — install + GitHub.

## Design system

Lock these tokens in `src/styles.css` as the only source of color. All components reference semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `text-muted-foreground`).

```text
--background        #f5f3ee  (warm cream)
--foreground        #1a1a1a  (near-black)
--primary           #e85d3a  (ReadyCode orange)
--primary-foreground #ffffff
--muted             #ebe8e1
--muted-foreground  #6b6b6b  (derived from #94a3b8 family, warmed)
--border            #e0ddd5
--accent            #1a1a1a
--radius            0.75rem
```

Typography: Inter (already available) — generous weights, large display sizes on the hero. Subtle hover lift on cards, no heavy motion.

## Files to add / change

- `src/styles.css` — replace color tokens with the palette above (light only; dark mode out of scope for v1).
- `src/routes/__root.tsx` — drop the "DO NOT PUBLISH" framing, add `<SiteHeader />` + `<SiteFooter />` around `<Outlet />`, set sitewide og:type/og:site_name, JSON-LD Organization.
- `src/routes/index.tsx` — replace placeholder with Home sections above.
- `src/routes/install.tsx` — new.
- `src/routes/privacy.tsx` — new, content mirrored from `extension/PRIVACY.md`.
- `src/components/site/SiteHeader.tsx`, `SiteFooter.tsx`, `Section.tsx`, `FeatureCard.tsx`, `StepRow.tsx`, `CTAButtons.tsx` — small presentational components.
- `public/og-image.jpg` — generated 1200×630 share image for the home route only (leaf-level `og:image`; never on `__root.tsx`).
- `public/favicon.ico` + `public/icon-512.png` — reuse `extension/icon.png` resized.
- `public/robots.txt` — `Allow: /`, `Sitemap: https://imagekit.readycode.ai/sitemap.xml`.
- `src/routes/sitemap[.]xml.tsx` — server route returning the three URLs.
- `mem://index.md` — updated per "Memory rule update" above.

## What we explicitly do NOT do

- No backend, no Supabase calls, no auth on the marketing site.
- No imports from `extension/`. `vite.config.ts` stays as-is.
- No "Edit with Lovable" badge changes in this plan (separate decision; requires Pro).
- No custom-domain wiring in code — that's handled in Project Settings once the user publishes.

## Post-implementation steps the user does

1. Publish the project (Publish button).
2. In Project Settings → Domains, confirm `imagekit.readycode.ai` is connected (already shown in project URLs).
3. Submit/refresh the Chrome Web Store listing with `https://imagekit.readycode.ai` as homepage and `https://imagekit.readycode.ai/privacy` as privacy policy URL.
