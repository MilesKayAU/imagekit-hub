import { createFileRoute, Link } from "@tanstack/react-router";
import manifest from "../../extension/manifest.json";

const EXTENSION_VERSION = manifest.version;

const TITLE = "Install ReadyCode ImageKit";
const DESCRIPTION =
  "Install the ReadyCode ImageKit Chrome extension from the Web Store, or load the open-source build from GitHub in under a minute.";
const URL = "https://imagekit.readycode.ai/install";
const HOSTED_ZIP = "https://imagekit.readycode.ai/readycode-imagekit-oss.zip";
const GITHUB_REPO = "https://github.com/MilesKayAU/imagekit-hub";

export const Route = createFileRoute("/install")({
  component: InstallPage,
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

function InstallPage() {
  const handleGitHubDownload = () => {
    window.open(HOSTED_ZIP, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Install ImageKit
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Two ways to install. The Web Store is the easiest. The manual build is for developers and reviewers.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Current version: <span className="font-mono text-foreground">v{EXTENSION_VERSION}</span>
      </p>

      <section className="mt-12 rounded-xl border border-border bg-card p-8">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">Recommended</span>
          <h2 className="text-2xl font-semibold text-foreground">From the Chrome Web Store</h2>
        </div>
        <ol className="mt-6 list-decimal space-y-3 pl-6 text-sm text-muted-foreground">
          <li>Open the ReadyCode ImageKit listing on the Chrome Web Store.</li>
          <li>Click <span className="text-foreground">Add to Chrome</span>, then <span className="text-foreground">Add extension</span>.</li>
          <li>Pin the extension from the puzzle-piece menu so the icon is always visible.</li>
          <li>Click the icon to open the side panel.</li>
        </ol>
        <p className="mt-6 text-sm text-muted-foreground">
          The Web Store listing link will appear here once the v1.0 review is approved.
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-semibold text-foreground">From GitHub (manual)</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The whole extension is open source. Anyone can audit it, build it, or run it unpacked.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleGitHubDownload}
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Download latest build zip (v{EXTENSION_VERSION})
          </button>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            View source on GitHub
          </a>
        </div>
        <ol className="mt-6 list-decimal space-y-3 pl-6 text-sm text-muted-foreground">
          <li>
            Download the latest build zip:{" "}
            <a
              href={HOSTED_ZIP}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline-offset-4 hover:underline"
            >
              readycode-imagekit-oss.zip (latest build)
            </a>
            , or clone the repo and use the <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">extension/</code> folder.
          </li>
          <li>Unzip it somewhere stable on your machine.</li>
          <li>
            Open <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">chrome://extensions</code> and toggle{" "}
            <span className="text-foreground">Developer mode</span> on (top right).
          </li>
          <li>
            Click <span className="text-foreground">Load unpacked</span> and select the unzipped{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">extension/</code> folder.
          </li>
          <li>Pin the extension and click the icon to open the side panel.</li>
        </ol>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-semibold text-foreground">Then: link ReadyCode</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The connect page now handles signup, BYOK key entry, and your token in one place — no separate signup step.
        </p>
        <ol className="mt-6 list-decimal space-y-3 pl-6 text-sm text-muted-foreground">
          <li>
            Open{" "}
            <a href="https://readycode.ai/imagekit/connect" target="_blank" rel="noreferrer" className="text-foreground underline-offset-4 hover:underline">
              readycode.ai/imagekit/connect
            </a>{" "}
            and sign up (or sign in) inline.
          </li>
          <li>
            Add your AI provider key in the same flow — OpenRouter recommended (one key covers most image models). Your provider bills you directly; ReadyCode never touches an image model.
          </li>
          <li>Copy the connect token (<code className="rounded bg-muted px-1.5 py-0.5 text-foreground">RC1.…</code>) shown at the bottom of the page.</li>
          <li>
            Open the extension's side panel, go to <span className="text-foreground">Get started</span> → <span className="text-foreground">Paste token</span> (or click <span className="text-foreground">Link</span> in the header), and paste.
          </li>
        </ol>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-8">
        <h2 className="text-2xl font-semibold text-foreground">What it does</h2>
        <ul className="mt-6 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
          <li>Right-click any image on the web and respin it in a new style.</li>
          <li>Refine any result with follow-up instructions — iterate without starting over.</li>
          <li>Pull saved Library images in as references — combine a product shot with an ingredient, etc.</li>
          <li>Save results to your ReadyCode Library, accessible from any device.</li>
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          ← Back home
        </Link>
        <Link
          to="/privacy"
          className="inline-flex items-center justify-center rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Read the privacy policy
        </Link>
      </div>
    </div>
  );
}