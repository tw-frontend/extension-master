import { browserLabel } from "@/lib/browsers";

export function BrowserBadge({ browser }: { browser: string }) {
  return (
    <span
      title={`Supports ${browserLabel(browser)}`}
      className="inline-flex items-center rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted"
    >
      {browserLabel(browser)}
    </span>
  );
}