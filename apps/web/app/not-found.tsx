import Link from "next/link";
import { Puzzle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Puzzle className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Extension not found</h1>
      <p className="text-sm text-muted">
        The extension you are looking for does not exist (or was moved).
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
      >
        Back to all extensions
      </Link>
    </div>
  );
}
