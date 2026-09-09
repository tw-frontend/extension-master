import Link from "next/link";
import { Puzzle } from "lucide-react";

import { repoUrl } from "@/lib/site";

import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const github = repoUrl();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight text-foreground"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Puzzle className="h-4 w-4" aria-hidden />
          </span>
          Extensions Hub
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/#extensions"
            className="rounded-md px-2 py-1 text-sm text-muted transition-colors hover:text-foreground"
          >
            Extensions
          </Link>
          {github ? (
            <a
              href={github}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-2 py-1 text-sm text-muted transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          ) : null}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
