# Implementation Plan: LLM Gate Companion — `gate-data`

Status: Approved on 2026-09-09  
Approved specification: [`../SPEC-gate-data.md`](../SPEC-gate-data.md)  
Capability map: [`../CAPABILITY-MAP-llm-gate-companion.md`](../CAPABILITY-MAP-llm-gate-companion.md)

## Overview

Build the first module of the LLM Gate Companion as a dependency-free Chromium Manifest V3 extension shell. The work proceeds in thin, usable paths: local API-key configuration first, then budget retrieval, date-ranged spend analytics, request analytics, and finally partial-success orchestration and packaging verification. Every external value is validated at the Simra boundary, and popup-facing messages never expose the stored key.

This plan covers only `gate-data`. Jalali calculations, interpretation of ranks/model counts, dashboard presentation, and OpenRouter recommendations remain outside this module.

## Dependency Graph

```text
Repository extension metadata + MV3 shell
    │
    └── Stable command/result contract
            │
            ├── API-key store
            │       └── configure/status/clear command path
            │
            ├── upstream response validators
            │       ├── budget client path
            │       ├── spend client path ── date-range validator
            │       └── requests client path ── date-range validator
            │
            └── load orchestration
                    └── independently settled endpoint results
                            └── validation + packaging checkpoint
```

The stable command/result contract is defined before the service-worker paths so callers cannot accidentally depend on ad-hoc exceptions or raw upstream response shapes.

## Architecture Decisions

- Create `extensions/llm-gate-companion` as a source-equals-build extension, matching `openrouter-deals`. This avoids a bundler and new dependencies for the API boundary.
- Keep all Simra URL creation and fetch behavior in `src/gate/client.js`. No other module may receive the API key or construct an authenticated URL.
- Keep the API key behind a small injected storage adapter in `src/gate/key-store.js`. The background worker may retrieve it internally, but public status and load responses cannot return it.
- Define a stable, discriminated result shape in `src/gate/result.js`. Expected failures cross the command boundary as values with a code and retryability; unexpected internal exceptions are converted to a redacted `UPSTREAM_ERROR` result.
- Validate third-party JSON before converting snake-case fields to camel-case values. Array order is preserved but explicitly not contractual.
- Validate ISO dates lexically and calendrically before comparing them. A reversed range is rejected rather than silently changed.
- Fetch budget, spend, and requests concurrently only after configuration and range validation succeed. Use independently settled results so an endpoint failure does not discard successful siblings.
- Inject `fetch`, storage, and the current clock into boundary functions. Tests remain deterministic and need neither Chrome nor live network access.
- Keep the manifest host permission limited to `https://llm.simra.cloud/*`; request no cookies, tabs, scripting, or content-script access.

## Implementation Slices

### Slice 1: Installable shell and secret lifecycle

Create the extension package/config/manifest/README shell, the common result contract, the key-store adapter, and the background `configure`, `status`, and `clear` command path. At the end of the slice, the unpacked extension is structurally valid and the complete secret lifecycle works through mocked Chrome messaging without disclosing the key.

Verification checkpoint:

- Key replacement, status, clearing, and redaction tests pass.
- Syntax checks and `pnpm extension:validate llm-gate-companion` pass.
- Manifest permissions contain only `storage` and the Simra host permission.

### Slice 2: Remaining-budget path

Add URL construction, fetch/timeout behavior, shared HTTP error mapping, the budget response validator/normalizer, and budget loading through the background boundary. This is the first complete remote-data path and exercises the highest-risk security behavior: putting an API key in the required query parameter without leaking it elsewhere.

Verification checkpoint:

- Tests prove correct percent-encoding, `credentials: "omit"`, `cache: "no-store"`, JSON acceptance, and timeout behavior.
- Budget fixtures normalize correctly; malformed data and every documented error category produce stable, redacted results.
- No source, fixture, snapshot, or test assertion contains the exposed real key.

### Slice 3: Date-ranged spend path

Add strict Gregorian date validation and the spend response validator/normalizer, then expose spend loading through the same client and background contract. The slice delivers a complete valid-range path while preventing all network activity for missing, impossible, or reversed dates.

Verification checkpoint:

- Date tests cover leap years, impossible dates, formatting errors, equal endpoints, valid inclusive ranges, and reversed ranges.
- Spend fixtures normalize totals, daily rows, and model rows exactly.
- Invalid ranges produce `INVALID_DATE_RANGE` with zero fetch calls.

### Slice 4: Request analytics and partial-success aggregation

Add request-response validation/normalization and complete `gate/load` so budget, spend, and requests settle independently. Preserve all validated upstream rank/count fields without semantic interpretation, including currently inconsistent model counts.

Verification checkpoint:

- The supplied request fixture normalizes every documented field without reordering or reinterpretation.
- One or two endpoint failures do not remove successful sibling results.
- Missing configuration and an invalid range stop the entire load before fetch begins.
- Background integration tests cover all four command variants.

### Slice 5: Module completion and repository integration

Complete security/usage documentation, run coverage and syntax checks, validate/package the extension, inspect the ZIP layout, and synchronize the generated extension registry. This slice changes no runtime behavior unless verification reveals a spec violation.

Verification checkpoint:

- Focused tests meet 100% branch coverage for date validation, key redaction, contracts, and error mapping, with at least 90% statement coverage across `gate-data`.
- `pnpm --filter llm-gate-companion check` passes.
- `pnpm extension:validate llm-gate-companion` passes.
- `pnpm extension:package llm-gate-companion` produces a ZIP with `manifest.json` at its root and no tests, real secrets, or development-only files.
- `pnpm extension:sync` produces only the expected registry/icon changes.

## Sequential and Parallel Work

Must remain sequential:

1. Agree on the command/result contract before implementing background handlers.
2. Complete shared HTTP/error behavior before adding all three endpoint paths.
3. Complete date validation before exposing spend or requests loading.
4. Complete individual paths before partial-success orchestration.
5. Complete runtime work before packaging and registry synchronization.

Safe to implement in parallel after the shared contracts exist:

- Spend response validator/tests and request response validator/tests.
- README security documentation and isolated contract fixtures.

No agent parallelization is required for this small module. Parallelism is an implementation option only if explicitly requested later.

## Verification Strategy

Tests run from narrowest to broadest:

1. Pure unit tests for result helpers, dates, key storage, and response validators.
2. Client tests with injected fetch for URL/options, timeout, JSON, and HTTP mappings.
3. Background integration tests with mocked Chrome storage/runtime and mocked fetch.
4. Extension syntax, metadata, permission, and package validation.
5. Optional manual live verification only after the user supplies a rotated key through the installed extension UI in a later module. `gate-data` automated verification never calls the live API.

Each slice must leave focused tests green. Full module verification runs after Slices 2, 4, and 5.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Required query authentication can expose a key through logs or errors | High | Centralize URL construction; never log URLs; sanitize thrown messages; do not include request objects in results |
| `chrome.storage.local` is not encrypted | High | State this clearly; never expose the saved value to popup callers; support immediate replacement/removal; request no sync storage |
| Unknown Simra error/status behavior | Medium | Map both 401 and 403 to `UNAUTHORIZED`; preserve generic HTTP status without upstream bodies; keep mapping additive |
| Upstream response fields or types drift | Medium | Validate every required field and fail the affected resource as `INVALID_RESPONSE`; preserve successful siblings |
| Request analytics currently contains internally inconsistent counts | Medium | Preserve values without deriving or interpreting them in this module; resolve semantics in `usage-insights` |
| MV3 worker suspension interrupts a request | Medium | Keep calls stateless and idempotent; surface a retryable network/timeout result; let later UI actions retry |
| Coverage tooling would require a dependency | Low | Use Node 20's built-in test coverage support; if the available Node release cannot enforce thresholds reliably, ask before adding tooling |
| Registry synchronization introduces unrelated generated changes | Low | Inspect the diff and keep only changes attributable to `llm-gate-companion` |

## Decisions Deferred to Later Modules

- Jalali month conversion, Tehran timezone boundaries, and “days remaining” wording belong to `usage-insights`.
- Meanings and presentation of `user_rank`, `rank_by_spend`, and `rank_by_avg_spend` belong to `usage-insights`.
- Whether model “usage” means request count, spend, or both belongs to `usage-insights`.
- Popup visual design and API-key entry controls belong to `extension-ui`; `gate-data` exposes only the background commands required by that UI.
- OpenRouter crawler extraction and sharing belong to `model-advisor`.

## Phase Gate

After this plan is approved, Phase 3 will create `tasks/todo.md` with discrete tasks. Each task will touch no more than approximately five files, include explicit acceptance criteria and commands, and follow the dependency order above. No implementation begins until that task list is reviewed and approved.
