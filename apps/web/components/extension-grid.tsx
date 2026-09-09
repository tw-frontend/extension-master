"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { RegistryEntry } from "@extensions-hub/extension-registry";

import type { ReleaseInfo } from "@/lib/releases";

import { ExtensionCard } from "./extension-card";

interface FilterableValues {
  statuses: string[];
  categories: string[];
  browsers: string[];
}

interface ExtensionGridProps {
  extensions: RegistryEntry[];
  releases: Record<string, ReleaseInfo | null>;
}

export function ExtensionGrid({ extensions, releases }: ExtensionGridProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [browser, setBrowser] = useState("all");

  const available: FilterableValues = {
    statuses: [...new Set(extensions.map((e) => e.status))].sort(),
    categories: [...new Set(extensions.flatMap((e) => e.categories))].sort(),
    browsers: [...new Set(extensions.flatMap((e) => e.browserSupport))].sort(),
  };

  const filtered = extensions.filter((e) => {
    const q = query.trim().toLowerCase();
    if (q && !`${e.name} ${e.shortDescription} ${e.categories.join(" ")}`.toLowerCase().includes(q))
      return false;
    if (status !== "all" && e.status !== status) return false;
    if (category !== "all" && !e.categories.includes(category)) return false;
    if (browser !== "all" && !e.browserSupport.includes(browser as never)) return false;
    return true;
  });

  return (
    <section id="extensions" className="scroll-mt-20">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search extensions…"
            aria-label="Search extensions"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-faint focus:border-border-strong focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={status} onChange={setStatus} all="All statuses" values={available.statuses} />
          <Select value={category} onChange={setCategory} all="All categories" values={available.categories} />
          <Select value={browser} onChange={setBrowser} all="All browsers" values={available.browsers} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          No extensions match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((extension) => (
            <ExtensionCard
              key={extension.id}
              extension={extension}
              release={releases[extension.id] ?? null}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Select({
  value,
  onChange,
  values,
  all,
}: {
  value: string;
  onChange: (v: string) => void;
  values: string[];
  all: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={all}
      className="h-10 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground focus:border-border-strong focus:outline-none"
    >
      <option value="all">{all}</option>
      {values.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
}
