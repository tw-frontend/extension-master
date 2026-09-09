#!/usr/bin/env node
/**
 * Reads a newline-separated list of changed files as $1 (or stdin) and prints
 * a JSON array of extension ids that must be rebuilt/released.
 *
 * Rules:
 *  - extensions/<id>/**  → that extension changed
 *  - packages/**, pnpm-lock.yaml, package.json, pnpm-workspace.yaml → all extensions changed
 *  - apps/web/**, docs/**, *.md at repo root → no extension rebuilds
 */
const input = process.argv[2] ?? "";
const changed = input.split(/\s+/).filter(Boolean);

const ALL_TRIGGERS = ["packages/", "pnpm-lock.yaml", "package.json", "pnpm-workspace.yaml"];

import fs from "node:fs";
const all = fs
  .readdirSync("extensions", { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const touched = new Set();
for (const file of changed) {
  const match = file.match(/^extensions\/([^/]+)(\/.*)?$/);
  if (match && all.includes(match[1])) {
    touched.add(match[1]);
    continue;
  }
  if (ALL_TRIGGERS.some((p) => file === p || file.startsWith(p))) {
    for (const id of all) touched.add(id);
  }
}

process.stdout.write(JSON.stringify(all.filter((id) => touched.has(id))));
