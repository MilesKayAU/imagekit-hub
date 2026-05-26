import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} ReadyCode. Open source under{" "}
          <a
            href="https://github.com/MilesKayAU/imagekit-hub/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            MIT
          </a>
          .
        </p>
        <nav className="flex flex-wrap gap-5">
          <Link to="/install" className="hover:text-foreground">Install</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <a href="https://github.com/MilesKayAU/imagekit-hub" target="_blank" rel="noreferrer" className="hover:text-foreground">
            GitHub
          </a>
          <a href="https://readycode.ai" target="_blank" rel="noreferrer" className="hover:text-foreground">
            readycode.ai
          </a>
        </nav>
      </div>
    </footer>
  );
}