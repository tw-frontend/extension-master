# Spec: Adaptive OpenRouter model selection

## Objective

Replace the OpenRouter Daily Deals extension's static provider preference and
family allowlist with evidence-based recommendations across the first 200 text
models returned by OpenRouter's weekly-popularity catalog.

The extension has two honest operating modes:

- **Intelligent mode:** enabled when the user supplies an OpenRouter API key.
  Rankings use current benchmark evidence plus live price and provider
  performance.
- **Discovery mode:** available without a key. Rankings use only observable
  market and runtime evidence and never claim to identify the most capable
  model.

The target user is a developer choosing a model for a concrete workload. The
feature succeeds when a newly released or previously unknown model can become
a recommendation without a code release or provider-specific rule.

## Recommendation contract

The candidate universe is the first 200 valid, non-router text models from
`GET /api/v1/models?output_modalities=text&sort=top-weekly`.

Intelligent mode provides these purposes:

1. Coding and debugging
2. Planning and architecture
3. Agentic execution
4. Best value above a benchmark quality floor
5. Critical work, where capability outranks price

Discovery mode provides only claims supported without benchmark evidence:

1. Most used
2. Lowest request cost
3. Fastest first token
4. Fastest output
5. Longest context

The same model may legitimately lead more than one purpose. The UI must not
substitute a weaker model merely to create visual variety.

Daily Deals considers the complete candidate universe. Intelligent mode uses
benchmark quality as part of deal ordering; Discovery mode uses discounts,
request cost, weekly popularity, and measured provider performance. Neither
mode gives a provider or model family a hardcoded bonus.

## Data and interfaces

- Anonymous catalog and endpoint requests continue to work without a key.
- With a key, the worker requests `GET /api/v1/benchmarks` and stores a
  validated, minimal score map plus source/as-of metadata.
- Benchmark records are joined by exact OpenRouter model slug or canonical
  slug. No fuzzy provider-name matching is used for intelligence scores.
- Missing benchmark fields remain missing. They are not converted to zero.
- External payloads are validated before they affect state or ranking.
- Benchmark failure does not block catalog, pricing, or provider scanning.

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
pnpm --dir extensions/openrouter-deals test
pnpm --dir extensions/openrouter-deals run check
```

Repository verification:

```text
pnpm extension:validate openrouter-deals
pnpm --filter web typecheck
```

## Code style and testing strategy

Keep the extension dependency-free and use small exported pure functions for
payload normalization and ranking. DOM rendering uses `textContent`; remote
strings are never inserted with `innerHTML`.

Tests must cover:

- arbitrary providers entering the top-200 candidate pool;
- benchmark validation and exact-slug matching;
- each Intelligent and Discovery purpose;
- no provider-family preference in Developer Picks or Daily Deals;
- benchmark authentication without key leakage;
- graceful fallback after 401, 429, malformed, or unavailable benchmark data;
- saving, replacing, and removing credentials without echoing the saved key.

## Boundaries

- Always: label the active mode and evidence date; expose missing evidence;
  preserve endpoint eligibility checks, backoff, accessibility, and local-only
  execution.
- Ask first: add another external data provider, send inference requests, add
  analytics, or broaden host permissions.
- Never: scrape screenshots, infer quality from marketing descriptions, store a
  key in recommendation state, log credentials, or claim an unbenchmarked
  model is objectively best.

## Success criteria

- No GLM/DeepSeek/Gemini/MiMo ordering or family allowlist remains in ranking
  code or UI.
- Any valid model in the top 200 can win a recommendation from its evidence.
- The extension remains useful without an API key and clearly calls that mode
  Discovery mode.
- A valid key enables benchmark-backed Intelligent mode; an invalid key falls
  back without breaking price scanning.
- Daily Deals evaluates all top-200 candidates rather than only reviewed
  families.
- Automated tests, syntax checks, extension validation, and browser smoke
  verification pass.

## Not doing

- Running paid inference evaluations across the catalog.
- Adding a server, account system, telemetry, or remote configuration.
- Combining third-party benchmark vendors outside OpenRouter's API.
- Claiming one universal best model independent of workload.
