#!/usr/bin/env node
/**
 * Reads a newline-separated list of changed files as $1 (or stdin) and prints
 * a JSON array of extension ids that must be rebuilt/released.
 *
 * Rules:
 *  - extensions/<id>/**  → that extension changed
 *  - packages/** source, pnpm-lock.yaml, package.json, pnpm-workspace.yaml → all extensions changed
 *  - packages/extension-registry/generated/** → metadata only; no extension rebuild
 *  - apps/web/**, docs/**, *.md at repo root → no extension rebuilds
 */
const ALL_TRIGGERS = ["packages/", "pnpm-lock.yaml", "package.json", "pnpm-workspace.yaml"];
const RELEASE_METADATA = ["packages/extension-registry/generated/"];

import fs from "node:fs";
import { pathToFileURL } from "node:url";

export function detectChangedExtensions(changed, all) {
  const touched = new Set();
  for (const file of changed) {
    const match = file.match(/^extensions\/([^/]+)(\/.*)?$/);
    if (match && all.includes(match[1])) {
      touched.add(match[1]);
      continue;
    }
    if (
      !RELEASE_METADATA.some((prefix) => file.startsWith(prefix)) &&
      ALL_TRIGGERS.some((path) => file === path || file.startsWith(path))
    ) {
      for (const id of all) touched.add(id);
    }
  }
  return all.filter((id) => touched.has(id));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2] ?? "";
  const changed = input.split(/\s+/).filter(Boolean);
  const all = fs
    .readdirSync("extensions", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  process.stdout.write(JSON.stringify(detectChangedExtensions(changed, all)));
}
