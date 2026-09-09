# Extensions Hub — Plan

This repository is the central home for my personal browser extensions. It is based on the
"Implementation Prompt — Personal Browser Extensions Hub" document, adapted to the current
reality: **two extensions migrated** (OpenRouter Daily Deals, Sazeh DevTools) and a
convention-driven architecture so every future extension is a folder + metadata file, never
a website edit.

## 1. Product goal

One GitHub repository that contains:

1. Independent source code per extension (`extensions/<id>/`).
2. Independent build commands per extension.
3. Independent documentation per extension (`extensions/<id>/README.md`).
4. Automatic ZIP generation per extension, with the production files at the ZIP root.
5. A central web dashboard listing every extension (this website).
6. A download button per extension that always points to the latest successful build ZIP.
7. GitHub Actions that detect which extension changed and build/release only the affected ones.
8. An architecture where adding an extension = create folder + `extension.config.json` (+ source + README). No dashboard edits, no workflow edits.
9. A polished, responsive, dark-first developer UI.
10. Dashboard deployable to Vercel.

Not a microservices project. A clean, developer-focused monorepo.

## 2. Technology choices

- **pnpm workspaces** — dependency management and `--filter` based builds.
- **TypeScript** everywhere, **Zod** for metadata validation.
- **Next.js (App Router)** + **React** + **Tailwind CSS** + **lucide-react** for the dashboard.
- **GitHub Actions** for CI and per-extension releases.
- **Vercel** for dashboard hosting.

Deliberate deviations from the original prompt (kept, with reasons):

- **No Turborepo (yet).** With one app + small packages, `pnpm --filter` covers everything.
  Turborepo can be added later without structural changes (see todo.md). Keeps the repo lean.
- **`extension.config.json` instead of `extension.config.ts`.** Metadata must be readable by
  the CI scripts *and* the website without a transpile step. It is validated at runtime with a
  Zod schema from `packages/extension-registry`, which gives the same guarantees. The schema
  and the validation are still TypeScript.
- **Generated registry snapshot.** `scripts/sync-registry.ts` scans `extensions/*/extension.config.json`,
  validates them, and writes `packages/extension-registry/generated/extensions.json` +
  copies icons into `apps/web/public/extensions/<id>/`. The website imports the typed registry
  package (no filesystem reads at runtime → deterministic on Vercel, no duplicated metadata).

## 3. Monorepo layout

```txt
extension-master/
├─ apps/
│  └─ web/                      # Next.js dashboard (the website)
│     ├─ app/                   # home, /extensions/[slug], layout
│     ├─ components/            # ExtensionCard, badges, filters, header/footer…
│     ├─ lib/                   # site config, GitHub releases fetcher
│     └─ public/extensions/     # generated icons (from sync script)
│
├─ extensions/
│  ├─ openrouter-deals/         # OpenRouter Daily Deals (vanilla JS, source == build)
│  └─ sazeh-devtools/           # Sazeh DevTools (Vite + CRXJS + React)
│
├─ packages/
│  └─ extension-registry/       # Zod schema + typed accessors + generated snapshot
│
├─ scripts/                     # tsx CLI scripts (sync, validate, package)
├─ artifacts/                   # local ZIP output (gitignored contents, .gitkeep)
├─ docs/
│  ├─ creating-extensions.md    # convention for new extensions
│  └─ migrating-extensions.md   # convention for moving existing extensions here
├─ .github/workflows/
│  ├─ ci.yml
│  └─ extensions-release.yml
├─ pnpm-workspace.yaml
├─ package.json
├─ plan.md / todo.md / README.md
```

## 4. Extension metadata system

Each extension owns `extensions/<id>/extension.config.json`, validated by
`packages/extension-registry/src/schema.ts`:

```jsonc
{
  "id": "openrouter-deals",              // slug, matches folder name
  "name": "OpenRouter Daily Deals",
  "shortDescription": "…",
  "description": "…",
  "version": "1.1.0",                    // must match package.json (+ manifest)
  "status": "stable",                    // stable | beta | alpha | wip | archived
  "icon": "./icons/icon-128.png",        // relative to the extension folder
  "browserSupport": ["chrome", "edge"],
  "categories": ["ai", "developer-tools"],
  "repositoryPath": "extensions/openrouter-deals",
  "features": ["…"],
  "installInstructions": ["…"],
  "permissions": ["storage", "alarms"],
  "hostPermissions": ["https://openrouter.ai/*"],
  "build": { "outputDir": ".", "exclude": ["tests", "README.md"] }
}
```

**Versioning** — per-extension, source of truth is the extension `package.json` version.
The web manifest must stay in sync (`openrouter-deals`: literal `manifest.json`;
`sazeh-devtools`: `manifest.config.ts` reads `pkg.version`). `pnpm extension:validate` fails
on any mismatch, and the release workflow fails instead of publishing mutable releases.

**Release/tagging convention** — one Git tag + GitHub Release per extension:

```txt
openrouter-deals-v1.1.0
sazeh-devtools-v0.1.2
```

Release asset: `<id>-v<version>.zip` with production files at the ZIP root
(`manifest.json` first level — never a nested `dist/`).

## 5. Dashboard website

- **Home**: header (logo/name, Extensions, GitHub, theme toggle) → compact hero
  ("Tools I built for the browser." + counts + GitHub link) → filter bar
  (search / status / category / browser) → responsive extension cards (icon, name,
  short description, version, status badge, browsers, tags, View details, **Download ZIP**).
- **Detail page** `/extensions/[slug]`: icon, name, version, status, description, features,
  permissions, screenshots (if any), install guide (Download → extract → `chrome://extensions`
  → Developer mode → Load unpacked → select packaged folder), browser compatibility,
  latest release info, source link, download button.
- **Dark-first** visual identity: dark, minimal, mono-flavored accents, subtle grid backdrop,
  strong typography, no glassmorphism/SaaS-gradient noise.
- **Release info** fetched server-side from the GitHub Releases API (`revalidate: 3600`,
  no client-side tokens). When no release exists yet, the site degrades gracefully:
  "Download temporarily unavailable — no release published yet", source link still available.

## 6. ZIP artifact & release strategy

1. `pnpm extension:build <id>` → production output under the extension's `build.outputDir`
   (sazeh-devtools: `dist/`; openrouter-deals: repo folder itself, no build step).
2. `pnpm extension:package <id>` → `artifacts/<id>-v<version>.zip` (files at ZIP root,
   excludes dev-only paths), validates `manifest.json` presence, prints SHA-256.
3. `extensions-release.yml` runs the same steps on `main`, detects changed extensions
   (`extensions/<id>/**` + shared `packages/**` rebuild impact), and publishes a GitHub
   Release per extension with the ZIP asset.
4. Website resolves the latest asset per extension from the Releases API. No ephemeral
   Actions artifacts, no client-side tokens.

## 7. CI / CD

- **ci.yml** (push/PR): install → lint/typecheck/test where available → registry sync +
  metadata validation → manifest/version consistency → build web → build + package every
  extension → verify ZIP structure. Never publishes.
- **extensions-release.yml** (push to `main`): detect changed extensions → for each:
  validate → build → package → SHA-256 → create tag `<id>-v<version>` + GitHub Release →
  upload ZIP. If the tag/release already exists, the job **fails** with "bump the version"
  instead of overwriting a release. `permissions: contents: write` scoped to the release job.

## 8. Migration status (current)

| Extension | Source | Status | Notes |
| --- | --- | --- | --- |
| OpenRouter Daily Deals (`openrouter-deals`) | Previous standalone repository | migrated, stable | vanilla MV3, source == build, own tests (`npm test`, `npm run check`) |
| Sazeh DevTools (`sazeh-devtools`) | Previous monorepo package | migrated, beta | Vite + CRXJS + React 19; workspace `typescript-config` dependency inlined into its `tsconfig.json` |

## 9. Convention documents

- `docs/creating-extensions.md` — the exact checklist for a **new** extension
  (folder, config, manifest, build, docs; dashboard + CI pick it up automatically).
- `docs/migrating-extensions.md` — how to bring an **existing** extension from another
  repo/monorepo here without breaking it, including dependency inlining and build
  adaptation patterns.

## 10. Future phases (non-goals for now)

- Turborepo remote caching when build times matter.
- Firefox/Edge-specific builds and per-browser download variants.
- Screenshots in extension metadata + gallery UI.
- A release manifest (`releases.json`) published by CI if the Releases API proves limiting.
- Extra extensions (Tailwind Token Manager, …) — just follow `docs/creating-extensions.md`.
