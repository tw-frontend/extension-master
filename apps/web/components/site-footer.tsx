import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>
          {SITE.name} — a personal monorepo of browser extensions.
        </span>
        <span className="font-mono">
          Built with Next.js · Deployed on Vercel
        </span>
      </div>
    </footer>
  );
}
