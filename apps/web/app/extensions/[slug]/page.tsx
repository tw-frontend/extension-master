import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Shield, Terminal } from "lucide-react";

import {
  getExtensionBySlug,
  getSlugs,
  type RegistryEntry,
} from "@extensions-hub/extension-registry";

import { BrowserBadge } from "@/components/browser-badge";
import { DownloadButton } from "@/components/download-button";
import { StatusBadge } from "@/components/status-badge";
import { VersionBadge } from "@/components/version-badge";
import { formatBytes, getLatestRelease, type ReleaseInfo } from "@/lib/releases";
import { SITE, sourceUrlFor } from "@/lib/site";

export const revalidate = 3600;

export function generateStaticParams() {
  return getSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const extension = getExtensionBySlug(slug);
  if (!extension) return { title: "Not found" };
  return {
    title: extension.name,
    description: extension.shortDescription,
    openGraph: { title: extension.name, description: extension.shortDescription },
  };
}

export default async function ExtensionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const extension = getExtensionBySlug(slug);
  if (!extension) notFound();

  const release: ReleaseInfo | null = await getLatestRelease(extension.id);
  const sourceUrl = sourceUrlFor(extension.repositoryPath, extension.sourceUrl);

  return (
    <div className="flex flex-col gap-10 py-12">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All extensions
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={extension.iconUrl}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-xl border border-border bg-surface-2 object-contain p-1.5"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {extension.name}
              </h1>
              <VersionBadge version={extension.version} />
              <StatusBadge status={extension.status} />
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {extension.shortDescription}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {extension.browserSupport.map((b) => (
            <BrowserBadge key={b} browser={b} />
          ))}
          {extension.categories.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-md bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-accent"
            >
              {c}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DownloadButton release={release} size="large" />
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-5 text-sm text-foreground transition-colors hover:border-border-strong"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            View source
          </a>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="flex flex-col gap-10">
          <Section title="About">
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
              {extension.description}
            </p>
          </Section>

          {extension.features.length > 0 ? (
            <Section title="Features">
              <FeatureList features={extension.features} />
            </Section>
          ) : null}

          <Section title="Installation">
            <InstallInstructions extension={extension} />
          </Section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-mono text-xs uppercase tracking-widest text-faint">
              Latest release
            </h2>
            {release?.zipUrl ? (
              <dl className="mt-3 space-y-2 text-sm">
                <ReleaseRow label="Version" value={`v${release.version}`} />
                <ReleaseRow label="Published" value={formatDate(release.publishedAt)} />
                {release.sizeBytes !== null ? (
                  <ReleaseRow label="ZIP size" value={formatBytes(release.sizeBytes)} />
                ) : null}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted">
                {SITE.githubRepo
                  ? "Download temporarily unavailable — no release published yet. You can still view the source."
                  : "Releases are not wired up yet. Set NEXT_PUBLIC_GITHUB_REPO to enable downloads."}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-faint">
              <Shield className="h-3.5 w-3.5" aria-hidden /> Permissions
            </h2>
            {extension.permissions.length || extension.hostPermissions.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {extension.permissions.map((p) => (
                  <span
                    key={p}
                    className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted"
                  >
                    {p}
                  </span>
                ))}
                {extension.hostPermissions.map((p) => (
                  <span
                    key={p}
                    className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted"
                  >
                    {p}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">No special permissions required.</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-faint">
              <Terminal className="h-3.5 w-3.5" aria-hidden /> Browser support
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {extension.browserSupport.map((b) => (
                <BrowserBadge key={b} browser={b} />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-faint">{title}</h2>
      {children}
    </section>
  );
}

function ReleaseRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="space-y-2">
      {features.map((feature) => (
        <li key={feature} className="flex gap-2.5 text-sm leading-relaxed text-muted">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
          {feature}
        </li>
      ))}
    </ul>
  );
}

function InstallInstructions({ extension }: { extension: RegistryEntry }) {
  const steps =
    extension.installInstructions.length > 0
      ? extension.installInstructions
      : [
          "Download the ZIP and extract it.",
          "Open chrome://extensions and enable Developer mode.",
          "Click Load unpacked and select the extracted build folder (the one containing manifest.json).",
        ];

  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 font-mono text-[11px] text-accent">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
