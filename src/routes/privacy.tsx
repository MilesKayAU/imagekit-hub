import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Privacy — ReadyCode ImageKit";
const DESCRIPTION =
  "What ReadyCode ImageKit reads, sends, and stores — in plain English. BYOK keys never leave your ReadyCode vault.";
const URL = "https://imagekit.readycode.ai/privacy";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
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

function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20">
      <header>
        <p className="text-sm font-medium uppercase tracking-widest text-primary">Privacy</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          ReadyCode ImageKit — Privacy
        </h1>
        <p className="mt-4 text-muted-foreground">
          ReadyCode ImageKit is a free, bring-your-own-key (BYOK) AI image studio that lives in the browser side panel. This page explains, in plain English, what the extension does with your data.
        </p>
      </header>

      <div className="prose-styles mt-12 space-y-10 text-foreground">
        <Section title="What ImageKit reads">
          <p>ImageKit only reads data when <strong>you take an action</strong> inside the side panel or context menu:</p>
          <ul>
            <li>when you click <strong>Grab visible tab</strong> — a single screenshot of the visible area of the active tab;</li>
            <li>when you right-click an image and pick <strong>Grab this image with ReadyCode ImageKit</strong> — the URL of that image;</li>
            <li>when you paste an image URL or upload a file from your device;</li>
            <li>when you sign in to ReadyCode in another tab — a short-lived access token used to authenticate calls to ReadyCode.</li>
          </ul>
          <p>ImageKit does <strong>not</strong> read pages in the background, follow you around the web, or capture anything before you act.</p>
        </Section>

        <Section title="What ImageKit sends">
          <p>When you press <strong>Generate</strong> or <strong>Respin</strong>, the following are sent to ReadyCode:</p>
          <ul>
            <li>the source image (URL or upload) and your text prompt;</li>
            <li>your selected style preset and target provider/model id;</li>
            <li>your ReadyCode session token (so the request can be billed to your BYOK provider on file).</li>
          </ul>
          <p>
            ReadyCode forwards the prompt and image to the AI provider whose API key you stored in your ReadyCode account (your BYOK key). <strong>ReadyCode never pays for image inference</strong> — your provider bills you directly.
          </p>
          <p>
            ImageKit does <strong>not</strong> send page content, browsing history, form data, passwords, or any tab content beyond the image you explicitly chose.
          </p>
        </Section>

        <Section title="Where data is stored">
          <ul>
            <li><strong>BYOK API keys</strong> are stored encrypted in your ReadyCode account vault, never in the extension or in <code>chrome.storage</code>.</li>
            <li><strong>Session tokens</strong> are stored in <code>chrome.storage.local</code> on this device only and can be cleared by signing out at readycode.ai or removing the extension.</li>
            <li><strong>Generated images you save</strong> live in a private storage bucket scoped to your account at <a href="https://readycode.ai/imagekit/library" className="text-primary underline-offset-4 hover:underline">readycode.ai/imagekit/library</a>.</li>
            <li><strong>No image content is shared with other ReadyCode users.</strong></li>
          </ul>
        </Section>

        <Section title="What ImageKit will not do">
          <ul>
            <li>It will not run on a page until you click an action.</li>
            <li>It will not capture or transmit images you did not explicitly select.</li>
            <li>It will not sell, share, or use your prompts or images to train any model.</li>
            <li>It will not bypass the per-provider rate limits or terms of your BYOK provider.</li>
          </ul>
        </Section>

        <Section title="Permissions, and why each is needed">
          <ul>
            <li><strong>storage</strong> — persist UI state and the linked ReadyCode session token locally.</li>
            <li><strong>sidePanel</strong> — render the ImageKit UI in the browser side panel.</li>
            <li><strong>activeTab</strong> — grab a single screenshot of the visible area of the active tab only when you click <strong>Grab visible tab</strong>.</li>
            <li><strong>scripting</strong> — inject a one-shot capture script for the <strong>Grab visible tab</strong> action.</li>
            <li><strong>contextMenus</strong> — add the "Grab this image with ReadyCode ImageKit" right-click entry.</li>
            <li><strong>tabs</strong> — open the ReadyCode library tab after you save an image.</li>
            <li><strong>host permissions</strong> for <code>readycode.ai</code>, <code>*.readycode.ai</code>, and the ReadyCode backend — required to call the edge function that brokers the BYOK request and to read your session.</li>
          </ul>
          <p>ImageKit does <strong>not</strong> request <code>&lt;all_urls&gt;</code>, <code>webRequest</code>, <code>notifications</code>, <code>alarms</code>, or <code>cookies</code>.</p>
        </Section>

        <Section title="Account requirement">
          <p>
            ImageKit requires a free ReadyCode account so the extension can resolve which BYOK provider to use and so saved images can be associated with your library. Account signup is at{" "}
            <a href="https://readycode.ai/signup" className="text-primary underline-offset-4 hover:underline">readycode.ai/signup</a>.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            <a href="mailto:privacy@readycode.ai" className="text-primary underline-offset-4 hover:underline">privacy@readycode.ai</a>
          </p>
        </Section>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-4 space-y-3 text-muted-foreground [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-foreground">
        {children}
      </div>
    </section>
  );
}