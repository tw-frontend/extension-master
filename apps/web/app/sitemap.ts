import type { MetadataRoute } from "next";

import { getSlugs } from "@extensions-hub/extension-registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...getSlugs().map((slug) => ({
      url: `${base}/extensions/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
