# Extensions Hub — TODO

Phase 0/1 = the initial build (website + two migrated extensions + conventions).
Later phases are opt-in; do them when they pay off.

## Phase 1 — Monorepo foundation ✅

- [x] pnpm workspace (`apps/*`, `extensions/*`, `packages/*`)
- [x] Root package.json with `extension:*` helper scripts
- [x] `packages/extension-registry` — Zod schema, typed accessors, generated snapshot
- [x] `scripts/sync-registry.ts` — scan + validate metadata, copy icons, write snapshot
- [x] `scripts/validate-extensions.ts` — schema + manifest/package.json version consistency
- [x] `scripts/package-extension.ts` — build → ZIP (files at root) → manifest check → SHA-256
- [x] `artifacts/` output directory (gitignored contents)

## Phase 2 — Extension migration ✅

- [x] Migrate `openrouter-deals` from its previous standalone repository
  (vanilla MV3, source == build output, tests kept under `tests/`)
- [x] Migrate `sazeh-devtools` from its previous monorepo package
  (Vite + CRXJS; inlined the former workspace `typescript-config` dependency)
- [x] `extension.config.json` for both (id, version, status, browsers, features, permissions, build)
- [x] Per-extension `README.md` preserved

## Phase 3 — Showcase website ✅

- [x] Next.js App Router + Tailwind CSS + lucide-react
- [x] Home: hero (counts, GitHub link), filter bar (search / status / category / browser), extension grid
- [x] Extension cards: icon, name, short description, version, status badge, browsers, tags, Download ZIP, View details
- [x] Detail page `/extensions/[slug]`: features, permissions, install guide (Chrome unpacked flow), browser compatibility, release info, source link
- [x] Server-side GitHub Releases fetch (ISR revalidate 3600) with graceful "download unavailable" fallback
- [x] Dark-first theme + theme toggle, responsive from 320px up
- [x] SEO metadata + per-extension dynamic metadata + generated sitemap
- [x] Placeholder site name/repo constants (`apps/web/lib/site.ts`) for easy rebranding

## Phase 4 — CI / release automation ✅

- [x] `ci.yml`: lint/typecheck/test → registry validation → build web → build + package + verify all extensions
- [x] `extensions-release.yml`: changed-extension detection on `main`, per-extension release `<id>-v<version>`, ZIP asset + SHA-256, fail on existing tag ("bump the version")
- [x] `permissions: contents: write` scoped to release job only

## Phase 5 — Docs ✅

- [x] `docs/creating-extensions.md` — convention for adding future extensions
- [x] `docs/migrating-extensions.md` — convention for migrating existing extensions in
- [x] Root `README.md` — overview, commands, release lifecycle

## Next steps (when needed)

- [ ] Push to GitHub and set `apps/web/lib/site.ts` `GITHUB_REPO` (+ Vercel project pointing at `apps/web`)
- [ ] Publish the first releases (`sazeh-devtools-v0.1.2`, `openrouter-deals-v1.1.0`) so download buttons go live
- [ ] Add Turborepo if/when build orchestration is worth it (turbo.json + `"build"` task graph)
- [ ] Add screenshots to extension metadata + gallery section on detail pages
- [ ] Optional: CI-published `releases.json` manifest if the Releases API ever limits us
- [ ] Add the next extension by following `docs/creating-extensions.md` (Tailwind Token Manager, …)
- [ ] Firefox/Edge packaging variants if an extension needs browser-specific builds
