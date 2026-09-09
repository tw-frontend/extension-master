/**
 * Node-based extension discovery — used by CLI scripts and CI only
 * (not by the web app, which consumes the generated snapshot).
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { extensionConfigSchema, type ExtensionConfig } from "./schema";

export const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
export const EXTENSIONS_DIR = path.join(REPO_ROOT, "extensions");
const GENERATED_DIR = path.join(import.meta.dirname, "../generated");
const WEB_ICONS_DIR = path.join(REPO_ROOT, "apps/web/public/extensions");

export interface RegistryEntry extends ExtensionConfig {
  iconUrl: string;
}

/** Reads and validates one extension's extension.config.json. Throws with a clear message. */
export function readExtensionConfig(extensionDir: string): ExtensionConfig {
  const file = path.join(extensionDir, "extension.config.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`Cannot read ${file}: ${(err as Error).message}`);
  }
  const result = extensionConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid extension config in ${file}:\n${issues}`);
  }
  return result.data;
}

/** Discovers and validates every extension under extensions/. Throws on the first error. */
export function loadRegistry(): RegistryEntry[] {
  const entries: RegistryEntry[] = [];
  for (const dir of readdirSync(EXTENSIONS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const config = readExtensionConfig(path.join(EXTENSIONS_DIR, dir.name));
    entries.push({ ...config, iconUrl: `/extensions/${config.id}/icon.png` });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Writes the generated snapshot consumed by the web app and copies icons to
 * apps/web/public/extensions/<id>/. Run via `pnpm extension:sync`.
 */
export function writeSnapshot(): void {
  const entries = loadRegistry();
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(
    path.join(GENERATED_DIR, "extensions.json"),
    JSON.stringify(entries, null, 2) + "\n",
  );
  for (const entry of entries) {
    const dir = path.join(WEB_ICONS_DIR, entry.id);
    mkdirSync(dir, { recursive: true });
    copyFileSync(path.join(EXTENSIONS_DIR, entry.id, entry.icon), path.join(dir, "icon.png"));
  }
}
