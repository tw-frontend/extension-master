/**
 * Web-safe registry accessors.
 *
 * Data comes from the generated snapshot (packages/extension-registry/generated/extensions.json),
 * produced by "pnpm extension:sync" from each extension's config file.
 * No Node builtins here so the Next.js build can bundle this module safely.
 */
import { z } from "zod";

import generated from "../generated/extensions.json";

import { extensionConfigSchema, type ExtensionConfig, type ExtensionStatus } from "./schema";

export * from "./schema";

export type RegistryEntry = ExtensionConfig & {
  /** Public icon URL on the web app. */
  iconUrl: string;
};

export const snapshotSchema = z.array(extensionConfigSchema);

function parseSnapshot(): RegistryEntry[] {
  const parsed = snapshotSchema.parse(generated);
  return parsed
    .map((entry) => ({ ...entry, iconUrl: `/extensions/${entry.id}/icon.png` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getExtensions(): RegistryEntry[] {
  return parseSnapshot();
}

export function getExtensionBySlug(slug: string): RegistryEntry | undefined {
  return getExtensions().find((e) => e.id === slug);
}

export function getSlugs(): string[] {
  return getExtensions().map((e) => e.id);
}
