# Extensions Hub

One repository, many browser extensions, one dashboard. Each extension keeps its own
source, version, build and docs; the website below lists them all and links every
download to a stable GitHub Release ZIP.

See `plan.md` for the architecture and `todo.md` for status.

## Layout

```txt
apps/web                      # Next.js dashboard (deployed to Vercel)
extensions/<id>               # one folder per extension + extension.config.json
packages/extension-registry   # Zod schema + typed accessors + generated snapshot
scripts/                      # pnpm extension:* CLI (list/sync/validate/build/package)
docs/                         # conventions: creating + migrating extensions
artifacts/                    # local ZIP output
.github/workflows             # ci.yml, extensions-release.yml
```

## Development

```bash
pnpm install
pnpm dev          # dashboard at http://localhost:3000 (runs extension:sync first)
```

## Common commands

```bash
pnpm build                        # build everything
pnpm lint / typecheck / test      # run across all packages that define them

pnpm extension:list               # list registered extensions
pnpm extension:validate           # validate configs + version consistency
pnpm extension:sync               # regenerate registry snapshot + icons for the web app
pnpm extension:build <id>         # build one extension
pnpm extension:package <id>       # build + ZIP + manifest check + sha256 → artifacts/
```

## Adding an extension

Follow `docs/creating-extensions.md` (new) or `docs/migrating-extensions.md` (existing).
Short version: create `extensions/<id>/`, add `extension.config.json`, run
`pnpm extension:sync` — it appears on the dashboard and CI picks it up. No website or
workflow edits.

## Release lifecycle

```txt
edit extension
→ bump version in extensions/<id>/package.json (+ extension.config.json / manifest)
→ merge into main
→ CI builds only the affected extension(s)
→ ZIP + SHA-256 published as GitHub Release <id>-v<version>
→ website download buttons resolve to the latest release automatically
```

Releases are immutable: if the tag already exists, CI fails with a "bump the version"
message instead of overwriting.

## Required repository settings

- GitHub Actions enabled (default).
- `NEXT_PUBLIC_GITHUB_REPO` = `owner/repo` (Vercel env) so download buttons resolve
  Releases; `NEXT_PUBLIC_GITHUB_URL` for the header link.
- The release workflow uses the built-in `GITHUB_TOKEN` with `contents: write`
  (scoped to the release job).

## Vercel

- Import the repo, set **Root Directory** to `apps/web`.
- Framework preset: Next.js. No extra services needed.
- Env: `NEXT_PUBLIC_GITHUB_REPO`, `NEXT_PUBLIC_GITHUB_URL` (optional but recommended).

## Assumptions

- Dashboard data comes from the committed, generated registry snapshot
  (`pnpm extension:sync`), keeping Vercel builds deterministic.
- Download buttons degrade gracefully ("Download unavailable") until the first release.
- Site name is a placeholder constant in `apps/web/lib/site.ts`.
