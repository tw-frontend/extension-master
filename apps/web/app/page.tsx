import Link from "next/link";
import { Github } from "lucide-react";

import { ExtensionGrid } from "@/components/extension-grid";
import { getExtensions } from "@extensions-hub/extension-registry";
import { getLatestRelease, type ReleaseInfo } from "@/lib/releases";
import { SITE, repoUrl } from "@/lib/site";

export const revalidate = 300;

export default async function HomePage() {
  const extensions = getExtensions();
  const stableCount = extensions.filter((e) => e.status === "stable").length;

  const releaseEntries = await Promise.all(
    extensions.map(async (e) => [e.id, await getLatestRelease(e.id)] as const),
  );
  const releases = Object.fromEntries(releaseEntries) as Record<string, ReleaseInfo | null>;
  const github = repoUrl();

  return (
    <div className="flex flex-col gap-14 py-12 sm:py-16">
      {/* Hero */}
      <section className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          Browser extensions
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {SITE.tagline}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          {SITE.description}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <span>
            <strong className="font-mono text-foreground">{extensions.length}</strong>{" "}
            {extensions.length === 1 ? "extension" : "extensions"}
          </span>
          <span>
            <strong className="font-mono text-foreground">{stableCount}</strong> stable
          </span>
          {github ? (
            <a
              href={github}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:text-accent hover:underline"
            >
              <Github className="h-4 w-4" aria-hidden />
              View on GitHub
            </a>
          ) : null}
          <Link
            href="#extensions"
            className="text-foreground underline-offset-4 hover:text-accent hover:underline"
          >
            Browse ↓
          </Link>
        </div>
      </section>

      {/* Extensions */}
      <ExtensionGrid extensions={extensions} releases={releases} />
    </div>
  );
}
