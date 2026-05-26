import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "DO NOT PUBLISH — ReadyCode ImageKit Source Repo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-6 py-16 text-center">
      <div className="rounded-lg border-4 border-red-500 bg-red-500/10 px-6 py-3 text-sm font-bold uppercase tracking-[0.3em] text-red-400">
        Warning
      </div>
      <h1 className="max-w-5xl text-5xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-7xl md:text-8xl">
        Do Not Publish
        <br />
        This Site
        <br />
        <span className="text-red-500">Via Lovable</span>
      </h1>
      <p className="max-w-2xl text-base text-zinc-500">
        If you accidentally clicked Publish, open the Publish dialog (top right)
        and click <span className="font-bold text-white">Unpublish</span>{" "}
        immediately.
      </p>
    </main>
  );
}
