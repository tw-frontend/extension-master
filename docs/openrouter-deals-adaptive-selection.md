# Spec: Customizable OpenRouter model selection

## Objective

Give each OpenRouter Daily Deals user direct control over Developer Picks across
the first 200 text models in OpenRouter's weekly-popularity catalog. Daily Deals
uses a separate, fixed quality/speed/cost balance.

The popup exposes three independent, combinable preferences:

1. **Cheaper** — prefer the lowest estimated cost for the user's token amounts.
2. **Smarter** — prefer the strongest available benchmark evidence.
3. **Faster** — prefer lower time to first token and higher output throughput.

At least one preference must remain selected. Selected preferences have equal
weight so the behavior is understandable and does not hide product-chosen
priorities from the user. The default is Cheaper because it works without
credentials or performance coverage.

## Recommendation contract

The candidate universe is the first 200 valid, non-router text models from
`GET /api/v1/models?output_modalities=text&sort=top-weekly`.

Each selected preference is normalized across the currently eligible models:

- Cheaper scores lower estimated request cost higher.
- Smarter scores higher mean Artificial Analysis indices from the public model
  catalog or exact-slug authenticated benchmark records.
- Faster scores the relative order from OpenRouter's public latency and
  throughput model sorts. Provider medians are used when available.

A model must have evidence for every selected preference. This prevents a
missing measurement from becoming an accidental advantage and prevents the
extension from silently ignoring a user's choice. The selected dimension
scores are averaged, then request cost, weekly popularity, and model ID provide
deterministic tie-breakers.

If no model has evidence for a selected dimension and another selected
dimension does have evidence, show provisional Developer Picks scored only by
the available selected dimensions. A sole preference remains empty until its
evidence is available. Name missing dimensions and never invent a score.

Developer Picks shows the five highest-ranked matches for the selected
preferences. Daily Deals ignores the checkboxes and weights quality 50%,
relative speed 30%, and request cost 20%. It highlights a model from the
stronger quality half, outside the slowest speed quarter, and below the upper
price quartile among usable models. Verified discounted alternatives remain
visible. No provider or model family receives a hardcoded bonus.

## Data and interfaces

- Anonymous catalog and endpoint requests continue to work without a key.
- The public catalog's `benchmarks.artificial_analysis` scores power Smarter
  without a key; the optional OpenRouter key refreshes benchmark records.
- Public latency and throughput sort orders power relative Faster rankings
  even when endpoint speed medians are null.
- With a key, the worker requests `GET /api/v1/benchmarks` and stores a
  validated, minimal score map plus source/as-of metadata.
- Benchmark records are joined by exact OpenRouter model slug or canonical
  slug. Model names and descriptions are never intelligence proxies.
- Missing benchmark and performance fields remain missing, not zero.
- Benchmark failure does not block catalog, pricing, or provider scanning.
- User settings, including selected preferences, persist in
  `chrome.storage.local`.

## Credential boundary

- The API key is optional and stored only in `chrome.storage.local` under a
  dedicated credentials record.
- The key is sent only to `https://openrouter.ai/api/v1/benchmarks` as a Bearer
  token.
- The key never enters recommendation state, rendered text, errors, logs,
  exports, URLs, or tests.
- The popup never reads a saved key back into the form. It displays only
  configured/not-configured status and offers Replace and Remove actions.
- Removing the key deletes the credentials record and benchmark-derived state.
- UI copy states that browser-profile storage is not encrypted and recommends
  a dedicated, limited OpenRouter key.

## Project structure and commands

- Runtime source: `extensions/openrouter-deals/`
- Unit tests: `extensions/openrouter-deals/tests/`
- Metadata: `extensions/openrouter-deals/extension.config.json`
- Generated registry: `packages/extension-registry/generated/extensions.json`

Focused verification:

```text
node tests/credentials.test.js
node tests/model-quality.test.js
node tests/preferences.test.js
node tests/pricing.test.js
node tests/background.test.js
node tests/developer-picks.test.js
node --check background.js
node --check popup.js
node --check pricing.js
node --check preferences.js
node --check developer-picks.js
```

Repository verification:

```text
node node_modules/tsx/dist/cli.mjs scripts/extension-cli.ts sync openrouter-deals
node node_modules/tsx/dist/cli.mjs scripts/extension-cli.ts validate openrouter-deals
node node_modules/typescript/bin/tsc --noEmit
```

## Code style and testing strategy

Keep the extension dependency-free and use small exported pure functions for
payload normalization and ranking. DOM rendering uses `textContent`; remote
strings are never inserted with `innerHTML`.

Tests must cover:

- arbitrary providers entering the top-200 candidate pool;
- single-preference and combined-preference ranking;
- exclusion when a selected preference lacks evidence;
- deterministic fallback when settings are absent or tampered with;
- Developer Picks using the user's preferences while Daily Deals stays fixed;
- no provider-family preference in either view;
- benchmark authentication without key leakage and graceful failure;
- saving, replacing, and removing credentials without echoing the saved key.

## Boundaries

- Always: show the active preferences and evidence availability; preserve
  endpoint eligibility checks, backoff, accessibility, and local-only
  execution.
- Ask first: add another external data provider, send inference requests, add
  analytics, or broaden host permissions.
- Never: scrape screenshots, infer quality from marketing descriptions, store
  a key in recommendation state, log credentials, or claim an unbenchmarked
  model is smarter.

## Success criteria

- Intelligent and Discovery mode names, branching, badges, and descriptions
  are removed.
- Cheaper, Smarter, and Faster are accessible multi-select buttons and persist
  per browser profile.
- Any non-empty combination changes Developer Picks using equal-weight ranking;
  Daily Deals remains fixed when these controls change.
- Public catalog scores support Smarter without a key; missing benchmark evidence
  produces an honest missing-data state rather than an intelligence guess.
- Public relative speed ranks support Faster when provider medians are absent.
- Any valid model in the top 200 can win from its evidence.
- Automated tests, syntax checks, extension validation, and browser smoke
  verification pass.

## Not doing

- Custom numeric weights or sliders in this version.
- Running paid inference evaluations across the catalog.
- Adding a server, account system, telemetry, or remote configuration.
- Combining third-party benchmark vendors outside OpenRouter's API.
- Claiming one universal best model independent of user preferences.
