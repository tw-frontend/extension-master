# Convention: Creating a new extension

Every extension lives in `extensions/<id>/` and is discovered **automatically** by the
dashboard, the validation scripts and CI. You never edit the website or workflows when
adding one.

## The one-paragraph rule

> If you can run `pnpm extension:validate <id>` green, the dashboard will show it,
> and CI will build + release it. Nothing else is required.

## 1. Folder + package

```txt
extensions/
  my-extension/
    package.json          # name = folder id, version = source of truth
    extension.config.json # metadata (schema below)
    README.md             # purpose, dev, build, install, permissions
    src/…                 # source (any framework)
    dist/…                # production build output (see §3)
```

Rules:

- `id` is **kebab-case** and **must equal the folder name**.
- `package.json` `"name"` must equal the id (keeps `pnpm --filter` and releases predictable).
- `package.json` `"version"` is the **source of truth** for releases.

## 2. `extension.config.json`

Validated by the Zod schema in `packages/extension-registry/src/schema.ts`:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | kebab-case, equals folder name |
| `name` | string | display name |
| `shortDescription` | string | ≤ 160 chars, used on cards |
| `description` | string | long text for the detail page |
| `version` | semver | must match `package.json` (and manifest) |
| `status` | `stable` \| `beta` \| `alpha` \| `wip` \| `archived` | badge on cards |
| `icon` | path | relative to the extension folder (png) |
| `browserSupport` | array | `chrome` `edge` `firefox` `safari` `brave` `opera` |
| `categories` | array | free-form tags, e.g. `developer-tools`, `ai` |
| `repositoryPath` | string | `extensions/<id>` |
| `screenshots` | string[] | optional, gallery is a future phase |
| `features` | string[] | feature bullets on the detail page |
| `installInstructions` | string[] | custom steps; Chrome unpacked flow added by default |
| `permissions` | string[] | shown on the detail page — keep minimal |
| `hostPermissions` | string[] | shown on the detail page |
| `build.outputDir` | path | `"dist"` for built extensions, `"."` when source == build |
| `build.command` | string? | optional pnpm script to run (omit = no build) |
| `build.exclude` | string[] | top-level entries excluded from the ZIP |
| `sourceUrl` | URL? | only if source lives outside this repo |

Minimal example:

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "shortDescription": "One-line pitch.",
  "description": "Longer description…",
  "version": "0.1.0",
  "status": "wip",
  "icon": "assets/icon-128.png",
  "browserSupport": ["chrome"],
  "categories": ["developer-tools"],
  "repositoryPath": "extensions/my-extension",
  "build": { "outputDir": "dist", "command": "build", "exclude": [] }
}
```

## 3. Build & packaging contract

- Production output goes to `extensions/<id>/dist/` (any bundler: WXT preferred for new
  extensions, Vite+CRXJS fine, plain MV3 with `outputDir: "."` also fine).
- Central packaging (`pnpm extension:package <id>`) zips the **contents** of `outputDir`
  with `manifest.json` at the ZIP root — never a nested `dist/` folder.
- If you need a build, add a `"build"` script and reference it in `build.command`.
- Keep permissions minimal; document each one in the extension README.

## 4. Version synchronization

- `package.json` version is the source of truth.
- The manifest must show the same version:
  - literal `manifest.json` → keep the numbers in sync (validator fails otherwise), or
  - `manifest.config.ts` → read `pkg.version` (like `sazeh-devtools` does) so it can't drift.

## 5. Make it appear on the dashboard

```bash
pnpm extension:sync     # regenerates the registry snapshot + copies icons to apps/web
```

Run from the repo root. Commit the updated
`packages/extension-registry/generated/extensions.json`. The web app picks it up on the
next dev/build (predev/prebuild hooks run it automatically).

## 6. Checklist

- [ ] `extensions/<id>/` folder, kebab-case id, package name = id
- [ ] `package.json` with version
- [ ] `extension.config.json` (valid per schema)
- [ ] `README.md`
- [ ] production build reachable at `build.outputDir` with `manifest.json` inside
- [ ] `pnpm extension:validate` green
- [ ] `pnpm extension:package <id>` produces a valid ZIP
- [ ] `pnpm extension:sync` committed
