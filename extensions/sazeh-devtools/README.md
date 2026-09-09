# @tw-frontend/sazeh-devtools

A standalone Chrome extension (MV3) for inspecting and overriding **Sazeh**
runtime config while developing.

Sazeh ([`@tw-frontend/sazeh-ui`](../sazeh-ui)) fetches remote config and caches
it in the page's `localStorage` under `tw-sazeh-<client>-<version>`. The service
reads that cache **once at startup**, so to try different config values you
normally have to edit localStorage by hand and reload. This extension turns that
into a typed form.

## What it does

- Finds every `tw-sazeh-*` config entry in the **active tab** and unwraps the
  stale-while-revalidate envelope (`{ value, staleAt, ttl }`).
- Renders a **typed editor**:
  - If the app publishes a JSON Schema descriptor (see below), fields, enums,
    numeric bounds and labels come from it.
  - Otherwise the form is **inferred from the live value's runtime types**
    (boolean → toggle, number → number input, string[] → list, …).
- **Save & Reload** writes your edits back and pushes `staleAt` ~1 year ahead so
  Sazeh's background revalidation won't overwrite your override on reload. Untick
  **Keep override** to write without pinning (the app may then refetch and
  replace it per its `staleMs`).
- **Reset** removes the key so the app fetches fresh config on the next load.

No remote permissions: it only uses `activeTab` + `scripting`, granted when you
click the toolbar icon.

## Make the editor schema-driven (optional)

The extension works with zero app changes (it infers types from the value). To
get exact types/enums/labels, have the app publish a JSON Schema descriptor —
`SazehUIService` writes it to `tw-sazeh-<client>-<version>__schema`:

```ts
import { z } from "zod";

new SazehUIService({
  /* …existing options… */
  schema: SazehConfigSchema,
  schemaJson: z.toJSONSchema(SazehConfigSchema), // ← publishes the descriptor
});
```

This is already wired up in `apps/chehreh` via
`shared/services/sazeh-web/use-sazeh.ts`.

## Develop / build

```bash
pnpm --filter @tw-frontend/sazeh-devtools dev     # vite + CRXJS HMR
pnpm --filter @tw-frontend/sazeh-devtools build   # production bundle -> dist/
```

## Load it in Chrome

1. `pnpm --filter @tw-frontend/sazeh-devtools build`
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select `packages/sazeh-devtools/dist`.
4. Open a page where Sazeh has run, click the extension icon, edit, **Save &
   Reload**.

(During `dev`, point "Load unpacked" at `dist` as well — CRXJS rebuilds it with
hot reload.)
