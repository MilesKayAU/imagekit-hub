import { createFileRoute, Link } from "@tanstack/react-router";
import heroSource from "@/assets/hero-source.png";
import heroResult from "@/assets/hero-result.png";

const TITLE = "ReadyCode ImageKit — AI image studio in your browser side panel";
const DESCRIPTION =
  "Free, open-source Chrome extension. Generate and respin images with your own AI provider key, then save them to your ReadyCode library.";
const URL = "https://imagekit.readycode.ai/";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

function Index() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div className="flex flex-col items-start gap-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Open source · MIT · BYOK
              </span>
              <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
                Turn any product shot into a{" "}
                <span className="text-primary">scroll-stopping scene.</span>
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                ReadyCode ImageKit is a free Chrome extension that respins, refines and saves AI product imagery from any tab — using your own AI provider key. No subscription, no markup.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/install"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Install for Chrome
                </Link>
                <a
                  href="https://github.com/MilesKayAU/imagekit-hub"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  View on GitHub
                </a>
              </div>
            </div>

            {/* Before → After showcase */}
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-2xl" />
              <div className="grid grid-cols-[1fr_auto_1.4fr] items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-xl sm:gap-4 sm:p-5">
                <figure className="flex flex-col gap-2">
                  <div className="overflow-hidden rounded-lg border border-border bg-muted/40 aspect-square flex items-center justify-center p-3">
                    <img
                      src={heroSource}
                      alt="Original product pouch — coffee machine cleaning tablets"
                      className="max-h-full max-w-full object-contain"
                      loading="eager"
                    />
                  </div>
                  <figcaption className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Source
                  </figcaption>
                </figure>

                <div className="flex flex-col items-center gap-1 text-primary">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Respin</span>
                </div>

                <figure className="flex flex-col gap-2">
                  <div className="overflow-hidden rounded-lg border border-border aspect-square">
                    <img
                      src={heroResult}
                      alt="AI-generated lifestyle scene: cleaning tablets beside a Breville espresso machine"
                      className="h-full w-full object-cover"
                      loading="eager"
                    />
                  </div>
                  <figcaption className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    AI respin · lifestyle scene
                  </figcaption>
                </figure>
              </div>

              <div className="mt-3 rounded-lg border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Prompt:</span> Take these coffee cleaning tablets and create a Shopify-ready shoot — beside a coffee machine, perfect lighting, hero placement.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What it does */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            What it does
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Three actions, one side panel. No new tab, no context switching.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                title: "Generate",
                body: "Type a prompt, pick a style preset, and create a fresh image with your chosen AI model.",
              },
              {
                title: "Respin",
                body: "Grab any image on the page (or upload one) and reimagine it with a new prompt and style.",
              },
              {
                title: "Save to Library",
                body: "One click sends the result to your private ReadyCode image library, ready to reuse.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 transition-transform hover:-translate-y-0.5"
              >
                <div className="mb-4 h-9 w-9 rounded-md bg-primary/10 ring-1 ring-primary/30">
                  <div className="m-auto h-full w-full" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border/60 bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Install the extension",
                body: "Add ImageKit from the Chrome Web Store, or load the open-source build from GitHub.",
              },
              {
                n: "02",
                title: "Bring your own key",
                body: "Connect your OpenRouter (or other provider) key on readycode.ai. ReadyCode never bills for inference.",
              },
              {
                n: "03",
                title: "Generate from any tab",
                body: "Open the side panel, prompt or right-click an image, then save the result to your library.",
              },
            ].map((s) => (
              <li key={s.n} className="rounded-xl border border-border bg-card p-6">
                <div className="text-xs font-semibold tracking-widest text-primary">{s.n}</div>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Open source & ReadyCode connection */}
      <section className="border-b border-border/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              Open source & free
            </h2>
            <p className="mt-3 text-muted-foreground">
              The extension is MIT-licensed and fully auditable on GitHub. You bring your own AI provider key — your provider bills you directly. No middleman, no markup.
            </p>
            <a
              href="https://github.com/MilesKayAU/imagekit-hub"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center text-sm font-medium text-primary hover:underline"
            >
              Read the source on GitHub →
            </a>
          </div>
          <div className="rounded-xl border border-border bg-card p-8">
            <h3 className="text-xl font-semibold text-foreground">Connected to ReadyCode</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              ImageKit stores your generated images in a private library on{" "}
              <a href="https://readycode.ai" target="_blank" rel="noreferrer" className="text-foreground underline-offset-4 hover:underline">
                readycode.ai
              </a>
              . The core storage tier is free today. Advanced features (team libraries, larger quotas, bring-your-own-storage) will be paid in the future — the extension itself stays free and open source.
            </p>
            <a
              href="https://readycode.ai/signup"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Create a free ReadyCode account
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section>
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Try ImageKit in under a minute.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Install the extension, link your free ReadyCode account, plug in your AI key, and start generating.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/install"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Install for Chrome
            </Link>
            <a
              href="https://github.com/MilesKayAU/imagekit-hub"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
