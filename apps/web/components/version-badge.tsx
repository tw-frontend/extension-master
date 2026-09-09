export function VersionBadge({ version }: { version: string }) {
  return (
    <span
      title={`Version ${version}`}
      className="inline-flex items-center rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted"
    >
      v{version}
    </span>
  );
}