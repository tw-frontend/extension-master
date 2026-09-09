import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import {
  EXTENSIONS_DIR,
  loadRegistry,
  readExtensionConfig,
  REPO_ROOT,
  writeSnapshot,
  type RegistryEntry,
} from "@extensions-hub/extension-registry/fs";

const ARTIFACTS_DIR = path.join(REPO_ROOT, "artifacts");

const log = (msg: string) => console.log(msg);
const die = (msg: string): never => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

function findEntry(id: string): RegistryEntry {
  const extensionDir = path.join(EXTENSIONS_DIR, id);
  try {
    return { ...readExtensionConfig(extensionDir), iconUrl: "" };
  } catch {
    return die(`unknown extension "${id}" — run pnpm extension:list`);
  }
}

function readPackageVersion(extensionDir: string): string | null {
  const pkgPath = path.join(extensionDir, "package.json");
  if (!existsSync(pkgPath)) return null;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
  return pkg.version ?? null;
}

function readManifestVersion(extensionDir: string, outputDir: string): string | null {
  for (const dir of [outputDir, extensionDir]) {
    const manifestPath = path.join(dir, "manifest.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string };
      return manifest.version ?? null;
    }
  }
  return null;
}

/** Runs the extension build (if it declares one) inside the extension's own directory. */
function buildExtension(entry: RegistryEntry, extensionDir: string): void {
  if (!entry.build.command) {
    log(`  no build command — source is the build (outputDir: ${entry.build.outputDir})`);
    return;
  }
  execFileSync("pnpm", ["run", entry.build.command], { cwd: extensionDir, stdio: "inherit" });
}

/** Zips the production output with manifest.json at the archive root. */
function packageExtension(entry: RegistryEntry, extensionDir: string): string {
  const pkgVersion = readPackageVersion(extensionDir);
  if (pkgVersion && pkgVersion !== entry.version) {
    die(
      `${entry.id}: extension.config.json version (${entry.version}) != package.json version (${pkgVersion}) — bump them together.`,
    );
  }

  const outputDir = path.join(extensionDir, entry.build.outputDir);
  if (!existsSync(path.join(outputDir, "manifest.json"))) {
    die(
      `${entry.id}: no manifest.json in ${path.relative(REPO_ROOT, outputDir)} — build the extension first.`,
    );
  }

  const zipPath = path.join(ARTIFACTS_DIR, `${entry.id}-v${entry.version}.zip`);
  rmSync(zipPath, { force: true });

  const excludes = [...entry.build.exclude, "node_modules", "extension.config.json", ".DS_Store"];
  // "e" matches a literal entry, "e/*" matches everything inside a directory.
  const excludeArgs = excludes.flatMap((e) => ["-x", e, "-x", `${e}/*`]);
  execFileSync("zip", ["-r", "-q", zipPath, ".", ...excludeArgs], { cwd: outputDir });

  // Sanity check: manifest.json must sit at the ZIP root, never nested under a folder.
  const listing = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" });
  const manifestEntry = listing
    .split("\n")
    .map((line) => line.trimEnd())
    .find((line) => /manifest\.json$/.test(line));
  if (!manifestEntry || /dist\/manifest\.json$/.test(manifestEntry)) {
    die(`${entry.id}: packaged ZIP must contain manifest.json at its root (got a nested layout).`);
  }

  const sha256 = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
  const sizeKb = (statSync(zipPath).size / 1024).toFixed(1);
  log(`  ✓ ${path.relative(REPO_ROOT, zipPath)} (${sizeKb} KB, sha256 ${sha256.slice(0, 16)}…)`);
  return zipPath;
}

function validateAll(): void {
  const entries = loadRegistry();
  log(`Validating ${entries.length} extension(s)…\n`);
  for (const entry of entries) {
    const extensionDir = path.join(EXTENSIONS_DIR, entry.id);
    if (!statSync(extensionDir).isDirectory()) die(`missing folder for ${entry.id}`);
    const problems: string[] = [];

    const pkgVersion = readPackageVersion(extensionDir);
    if (!pkgVersion) problems.push("package.json missing or has no version");
    else if (pkgVersion !== entry.version)
      problems.push(`config version ${entry.version} != package.json ${pkgVersion}`);

    const manifestVersion = readManifestVersion(extensionDir, entry.build.outputDir);
    const readsPkgVersion =
      existsSync(path.join(extensionDir, "manifest.config.ts")) &&
      /pkg\.version|package\.json/.test(readFileSync(path.join(extensionDir, "manifest.config.ts"), "utf8"));
    if (manifestVersion && manifestVersion !== entry.version)
      problems.push(`manifest version ${manifestVersion} != config version ${entry.version}`);
    if (!manifestVersion && !readsPkgVersion)
      problems.push("no manifest.json found and no manifest.config.ts that reads pkg.version");

    if (!existsSync(path.join(extensionDir, "README.md"))) problems.push("README.md missing");

    if (problems.length) {
      die(`${entry.id}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    }
    log(`✓ ${entry.id} v${entry.version} (${entry.status}) — ${entry.browserSupport.join(", ")}`);
  }
  log(`\nAll extension configs are valid.`);
}

async function main(): Promise<void> {
  const [cmd, id] = process.argv.slice(2);

  switch (cmd) {
    case "list": {
      const entries = loadRegistry();
      if (!entries.length) return log("No extensions found.");
      for (const e of entries) {
        log(`${e.id.padEnd(24)} v${e.version}  ${e.status.padEnd(7)} ${e.browserSupport.join(", ")}`);
      }
      return;
    }
    case "sync": {
      writeSnapshot();
      return log("✓ registry snapshot + icons synced into apps/web");
    }
    case "validate":
      return validateAll();
    case "build": {
      if (!id) die("usage: pnpm extension:build <id>");
      const entry = findEntry(id);
      log(`Building ${entry.id}…`);
      buildExtension(entry, path.join(EXTENSIONS_DIR, entry.id));
      return log(`✓ built ${entry.id}`);
    }
    case "package": {
      if (!id) die("usage: pnpm extension:package <id>");
      const entry = findEntry(id);
      log(`Packaging ${entry.id} v${entry.version}…`);
      buildExtension(entry, path.join(EXTENSIONS_DIR, entry.id));
      packageExtension(entry, path.join(EXTENSIONS_DIR, entry.id));
      return log(`✓ packaged ${entry.id}`);
    }
    default:
      die(`usage: tsx scripts/extension-cli.ts <list|sync|validate|build|package> [id]`);
  }
}

main().catch(die);
