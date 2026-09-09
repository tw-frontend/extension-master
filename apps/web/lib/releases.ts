import { SITE } from "./site";

export interface ReleaseInfo {
  /** Latest released version, when a release exists. */
  version: string;
  /** Stable download URL for the ZIP asset on GitHub Releases. */
  zipUrl: string | null;
  publishedAt: string | null;
  /** ZIP size in bytes, when exposed by the release asset. */
  sizeBytes: number | null;
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  published_at: string | null;
  created_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

/**
 * Resolves the latest GitHub Release for one extension using the
 * `<extension-id>-v<semver>` tag convention. Server-side only: the result is
 * cached via Next.js revalidation and the client never needs a token.
 */
export async function getLatestRelease(extensionId: string): Promise<ReleaseInfo | null> {
  if (!SITE.githubRepo) return null;

  const releases = await fetchReleases();
  if (!releases) return null;

  const prefix = `${extensionId}-v`;
  const match = releases
    .filter((r) => r.tag_name.startsWith(prefix))
    .sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at))[0];

  if (!match) return null;

  const version = match.tag_name.slice(prefix.length);
  const asset = match.assets.find((a) => a.name === `${extensionId}-v${version}.zip`);

  return {
    version,
    zipUrl: asset?.browser_download_url ?? null,
    publishedAt: match.published_at ?? match.created_at,
    sizeBytes: asset?.size ?? null,
  };
}

interface ReleasesCache {
  fetchedAt: number;
  data: GitHubRelease[];
}

// Module-level cache: one API call per server instance per TTL window,
// regardless of how many extensions need release info.
const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: ReleasesCache | null = null;

async function fetchReleases(): Promise<GitHubRelease[] | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;

  try {
    const res = await fetch(`https://api.github.com/repos/${SITE.githubRepo}/releases?per_page=100`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: CACHE_TTL_MS / 1000 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GitHubRelease[];
    cache = { fetchedAt: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
