/** Central place to rename the site or wire up the GitHub repository. */
export const SITE = {
  /** Rename the whole project by changing this constant. */
  name: "Extensions Hub",
  tagline: "Tools I built for the browser.",
  description:
    "A collection of small browser extensions that make my development workflow faster.",
  /** "owner/repo" used to resolve GitHub Releases for download links. */
  githubRepo: process.env.NEXT_PUBLIC_GITHUB_REPO ?? "",
  /** Plain https URL for the "View source" links. */
  githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL ?? "",
} as const;

export const REPO_SOURCE_BASE = "https://github.com";

export function sourceUrlFor(repositoryPath: string, sourceUrl?: string): string {
  if (sourceUrl) return sourceUrl;
  if (SITE.githubRepo) return `${REPO_SOURCE_BASE}/${SITE.githubRepo}/tree/main/${repositoryPath}`;
  return "#";
}

export function repoUrl(): string | null {
  return SITE.githubRepo ? `${REPO_SOURCE_BASE}/${SITE.githubRepo}` : null;
}
