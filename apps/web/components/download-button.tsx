import type { ReleaseInfo } from "@/lib/releases";

import { Download, PackageOpen } from "lucide-react";

interface DownloadButtonProps {
  release: ReleaseInfo | null;
  size?: "default" | "large";
}

export function DownloadButton({ release, size = "default" }: DownloadButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const sizing = size === "large" ? "h-11 px-5 text-sm" : "h-9 px-3.5 text-sm";

  if (release?.zipUrl) {
    return (
      <a
        href={release.zipUrl}
        className={`${base} ${sizing} bg-accent text-accent-contrast hover:opacity-90`}
        download
      >
        <Download className="h-4 w-4" aria-hidden />
        Download ZIP
      </a>
    );
  }

  const reason = release ? "Release asset missing" : "No release published yet";
  return (
    <span
      title={`${reason} — download will appear automatically after the first release`}
      className={`${base} ${sizing} cursor-not-allowed border border-border bg-surface-2 text-faint`}
      aria-disabled
    >
      <PackageOpen className="h-4 w-4" aria-hidden />
      Download unavailable
    </span>
  );
}