import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { RegistryEntry } from "@extensions-hub/extension-registry";

import type { ReleaseInfo } from "@/lib/releases";

import { BrowserBadge } from "./browser-badge";
import { DownloadButton } from "./download-button";
import { StatusBadge } from "./status-badge";
import { VersionBadge } from "./version-badge";

interface ExtensionCardProps {
  extension: RegistryEntry;
  release: ReleaseInfo | null;
}

export function ExtensionCard({ extension, release }: ExtensionCardProps) {
  return (
    <article className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={extension.iconUrl}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-lg border border-border bg-surface-2 object-contain p-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
              {extension.name}
            </h3>
            <VersionBadge version={extension.version} />
            <StatusBadge status={extension.status} />
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{extension.shortDescription}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {extension.browserSupport.map((b) => (
          <BrowserBadge key={b} browser={b} />
        ))}
        {extension.categories.map((c) => (
          <span
            key={c}
            className="inline-flex items-center rounded-md bg-accent-soft px-1.5 py-0.5 font-mono text-[11px] text-accent"
          >
            {c}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 pt-1">
        <DownloadButton release={release} />
        <Link
          href={`/extensions/${extension.id}`}
          className="inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          View details
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
