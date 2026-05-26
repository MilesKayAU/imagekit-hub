import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
          <span className="inline-block h-7 w-7 rounded-md bg-primary" aria-hidden />
          <span>ReadyCode <span className="text-muted-foreground">ImageKit</span></span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/install"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-2 text-foreground font-medium" }}
          >
            Install
          </Link>
          <Link
            to="/privacy"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-2 text-foreground font-medium" }}
          >
            Privacy
          </Link>
          <a
            href="https://github.com/MilesKayAU/imagekit-hub"
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <Link
            to="/install"
            className="ml-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Install for Chrome
          </Link>
        </nav>
      </div>
    </header>
  );
}