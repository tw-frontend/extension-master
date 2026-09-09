# Convention: Migrating an existing extension into this hub

Migrating means: copy the source, adapt the packaging surface, **don't rewrite the
extension**. Both existing extensions were migrated this way and serve as reference
implementations.

## The two migration patterns

| Pattern | When | Reference |
| --- | --- | --- |
| **A — source is the build** | Plain MV3 extension with no bundler | `extensions/openrouter-deals` |
| **B — bundler build** | Vite/WXT/CRXJS etc. produces `dist/` | `extensions/sazeh-devtools` |

## Steps

### 1. Copy the source (exclude build junk)

Copy the real source into `extensions/<id>/`. Skip: `node_modules/`, build outputs
(`dist/`, unless it's the source-is-build case), old ZIPs, CI configs of the old repo,
and stray screenshots.

```bash
# example used for openrouter-deals
cp <source-repo>/{manifest.json,background.js,popup.*,pricing.js,developer-picks.js,package.json,README.md} extensions/openrouter-deals/
cp -r <source-repo>/{icons,tests} extensions/openrouter-deals/
```

### 2. Normalize `package.json`

- `"name"` → the kebab-case id (must match the folder).
- Keep `"version"` from the old repo — it becomes the release baseline.
- If the extension came from a monorepo, **inline workspace-only bits**:
  - `workspace:*` dependencies → replace with the actual devDependency (e.g.
    `@tw-frontend/typescript-config` → copy the relevant `tsconfig` options into a
    self-contained `tsconfig.json`, like sazeh-devtools does now).
  - package-manager-specific tooling stays only if it works standalone.

### 3. Pattern A — source is the build

- Point `build.outputDir` at `"."` and omit `build.command`.
- Add everything that must NOT ship to `build.exclude` (e.g. `tests`, `README.md`,
  `package.json`).
- The validator accepts a literal `manifest.json` at the extension root as long as its
  version matches `package.json`.

### 4. Pattern B — bundler build

- Add/keep the `"build"` script; set `build.outputDir: "dist"` and `build.command: "build"`.
- If the manifest is generated (e.g. `manifest.config.ts` with `defineManifest`), make it
  read `pkg.version` — then version sync can never drift and the validator is happy.
- Check that no imports resolve outside the folder (`@scope/shared` from the old monorepo
  must be vendored or inlined).

### 5. Metadata + docs

- Create `extension.config.json` (schema table in `docs/creating-extensions.md` §2).
- Write the extension `README.md` (purpose, features, dev, build, install, permissions).
- Copy the icon path into `icon` (e.g. `icons/icon-128.png`, `public/logo.png`).

### 6. Verify

```bash
pnpm install
pnpm extension:validate
pnpm extension:build <id>      # only for pattern B
pnpm extension:package <id>    # produces artifacts/<id>-v<version>.zip
unzip -l artifacts/<id>-v<version>.zip   # manifest.json at the ZIP root
pnpm extension:sync            # dashboard shows it
pnpm --filter web dev          # eyeball the card + detail page
```

### 7. First release from here

- If the extension was already released elsewhere: **bump the patch version** before the
  first CI release from this repo, so the tag `<id>-v<version>` here is new and no
  release becomes mutable.
- Merge to `main`; the `Extensions Release` workflow builds, packages and publishes it.
- The dashboard download button goes live automatically once the release exists.

## Migration checklist

- [ ] source copied (no node_modules/ZIPs/old CI)
- [ ] `package.json`: name = id, version set, no `workspace:*` leftovers
- [ ] tsconfig/build config self-contained
- [ ] `extension.config.json` + `README.md`
- [ ] `pnpm extension:validate` green
- [ ] ZIP verified (`manifest.json` at root)
- [ ] version bumped for the first release here
