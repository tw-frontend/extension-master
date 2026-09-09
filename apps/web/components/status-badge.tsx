import type { ExtensionStatus } from "@extensions-hub/extension-registry";

const STATUS_STYLES: Record<ExtensionStatus, string> = {
  stable: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  beta: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  alpha: "bg-violet-500/10 text-violet-500 border-violet-500/30",
  wip: "bg-sky-500/10 text-sky-500 border-sky-500/30",
  archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

export function StatusBadge({ status }: { status: ExtensionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
