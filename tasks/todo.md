# Task List: LLM Gate Companion — `gate-data`

Status: Approved on 2026-09-09; implementation in progress

Plan: [`plan.md`](./plan.md)

Specification: [`../SPEC-gate-data.md`](../SPEC-gate-data.md)

Implementation proceeds in dependency order. A task is complete only when its acceptance criteria and verification steps pass. Do not place a real Simra API key, authentication URL, or cookie in source code, test output, fixtures, screenshots, or shell commands.

## Phase 1: Extension shell and secret lifecycle

### Task 1: Create the installable extension shell

**Description:** Add the minimum source-equals-build Chromium extension structure, metadata, package scripts, documentation shell, and one packaged PNG icon. Establish the final extension id and least-privilege permissions before runtime code grows around them.

**Acceptance criteria:**

- [x] Package name, folder id, manifest version, and extension metadata all use `llm-gate-companion` version `0.1.0` consistently.
- [x] Manifest permissions are limited to `storage`; host permissions are limited to `https://llm.simra.cloud/*`; no content script or remotely hosted code is configured.
- [x] The extension has a valid background service-worker entry, a local PNG icon, and source-equals-build packaging exclusions for tests and development files.

**Verification:**

- [x] Run `pnpm extension:validate llm-gate-companion`.
- [x] Run `pnpm --filter llm-gate-companion check`.
- [x] Inspect `manifest.json` and `extension.config.json` permission lists manually.

**Dependencies:** None

**Files likely touched:**

- `extensions/llm-gate-companion/package.json`
- `extensions/llm-gate-companion/manifest.json`
- `extensions/llm-gate-companion/extension.config.json`
- `extensions/llm-gate-companion/README.md`
- `extensions/llm-gate-companion/icons/icon-128.png`

**Estimated scope:** Medium (5 files)

### Task 2: Define stable results and local key storage

**Description:** Implement the discriminated success/failure helpers and an injected `chrome.storage.local` adapter for saving, replacing, detecting, loading internally, and clearing an API key. The public status contract exposes only whether configuration exists.

**Acceptance criteria:**

- [x] Result helpers produce only the documented stable error codes, message, retryability, and optional HTTP status.
- [x] Key storage trims input, rejects empty/invalid values, supports replacement and removal, and returns the key only through its internal client-facing method.
- [x] Tests prove public status and all errors omit the saved key.

**Verification:**

- [x] Run the focused result and key-store tests.
- [x] Run `pnpm --filter llm-gate-companion check`.

**Dependencies:** Task 1

**Files likely touched:**

- `extensions/llm-gate-companion/src/gate/result.js`
- `extensions/llm-gate-companion/src/gate/key-store.js`
- `extensions/llm-gate-companion/tests/gate-result.test.js`
- `extensions/llm-gate-companion/tests/gate-key-store.test.js`

**Estimated scope:** Medium (4 files)

### Task 3: Expose configure, status, and clear commands

**Description:** Add a testable background command handler for the secret lifecycle and connect it to the MV3 runtime message listener. Convert malformed commands and unexpected exceptions into redacted results rather than leaking implementation errors.

**Acceptance criteria:**

- [x] `gate/configure`, `gate/status`, and `gate/clear` work through the background command handler and always respond exactly once.
- [x] Unknown/malformed commands fail predictably without mutating storage.
- [x] Neither responses nor thrown/error paths contain the configured key.

**Verification:**

- [x] Run the focused background tests.
- [x] Run `pnpm --filter llm-gate-companion check`.

**Dependencies:** Task 2

**Files likely touched:**

- `extensions/llm-gate-companion/background.js`
- `extensions/llm-gate-companion/tests/background.test.js`

**Estimated scope:** Small (2 files)

## Checkpoint 1: Secret boundary

- [x] Run `pnpm --filter llm-gate-companion test`.
- [x] Run `pnpm extension:validate llm-gate-companion`.
- [x] Confirm no popup-facing command returns the key and no permission beyond `storage` plus the Simra host is present.
- [x] Stop and repair any secret leak before proceeding.

## Phase 2: Validated endpoint paths

### Task 4: Validate Gregorian API date ranges

**Description:** Implement strict calendar validation for `YYYY-MM-DD` inputs, including leap-year correctness, and reject reversed ranges before any network operation can begin.

**Acceptance criteria:**

- [x] Valid dates and same-day inclusive ranges succeed unchanged.
- [x] Missing, malformed, or impossible dates and `startDate > endDate` return `INVALID_DATE_RANGE`.
- [x] The validator is pure and has complete branch coverage.

**Verification:**

- [x] Run the focused date-range tests.
- [x] Run `node --experimental-test-coverage --test extensions/llm-gate-companion/tests/gate-date-range.test.js` and inspect 100% branch coverage for `date-range.js`.

**Dependencies:** Task 2

**Files likely touched:**

- `extensions/llm-gate-companion/src/gate/date-range.js`
- `extensions/llm-gate-companion/tests/gate-date-range.test.js`

**Estimated scope:** Small (2 files)

### Task 5: Deliver the remaining-budget path

**Description:** Implement centralized Simra URL/fetch behavior, shared HTTP and timeout mapping, runtime validation of the budget response, camel-case normalization, and the budget resource returned by `gate/load`.

**Acceptance criteria:**

- [x] Budget requests use an encoded `api_key`, `credentials: "omit"`, `cache: "no-store"`, JSON acceptance, and a 10-second timeout without logging the URL.
- [x] Valid budget fixtures normalize to `{ remainingBudget }`; malformed JSON/data and all documented transport/HTTP failures return stable redacted results.
- [x] Missing configuration causes zero fetch calls.

**Verification:**

- [x] Run the focused client, contract, and background tests.
- [x] Run `pnpm --filter llm-gate-companion check`.

**Dependencies:** Tasks 3 and 4

**Files likely touched:**

- `extensions/llm-gate-companion/src/gate/client.js`
- `extensions/llm-gate-companion/src/gate/contracts.js`
- `extensions/llm-gate-companion/tests/gate-client.test.js`
- `extensions/llm-gate-companion/tests/gate-contracts.test.js`
- `extensions/llm-gate-companion/background.js`

**Estimated scope:** Medium (5 files)

### Task 6: Deliver the date-ranged spend path

**Description:** Extend the established client and contract parser with spend analytics, using the already-approved date validator and the same stable error behavior.

**Acceptance criteria:**

- [x] Spend requests contain encoded `api_key`, `start_date`, and `end_date` parameters with no cookies or copied browser headers.
- [x] Totals, daily spend rows, and per-model spend rows normalize exactly to documented camel-case objects.
- [x] Invalid ranges cause zero fetch calls; malformed nested rows fail the spend resource as `INVALID_RESPONSE`.

**Verification:**

- [x] Run the focused date-range, client, contract, and background tests.
- [x] Run `pnpm --filter llm-gate-companion check`.

**Dependencies:** Task 5

**Files likely touched:**

- `extensions/llm-gate-companion/src/gate/client.js`
- `extensions/llm-gate-companion/src/gate/contracts.js`
- `extensions/llm-gate-companion/tests/gate-client.test.js`
- `extensions/llm-gate-companion/tests/gate-contracts.test.js`

**Estimated scope:** Medium (4 files)

### Task 7: Deliver the request-analytics path

**Description:** Extend the same boundary with the supplied requests response contract. Preserve all values—including inconsistent counts and all rank fields—without sorting, deriving, or assigning business meaning.

**Acceptance criteria:**

- [x] Request URLs use the approved range and request options shared with spend.
- [x] Every supplied top-level field plus daily/model rows normalizes to the documented camel-case shape without reinterpretation.
- [x] Missing, non-finite, or mistyped required fields and nested entries produce `INVALID_RESPONSE` for this resource only.

**Verification:**

- [x] Run the focused client, contract, and background tests.
- [x] Confirm the sanitized fixture contains all supplied fields but no key or cookie.

**Dependencies:** Task 6

**Files likely touched:**

- `extensions/llm-gate-companion/src/gate/client.js`
- `extensions/llm-gate-companion/src/gate/contracts.js`
- `extensions/llm-gate-companion/tests/gate-client.test.js`
- `extensions/llm-gate-companion/tests/gate-contracts.test.js`

**Estimated scope:** Medium (4 files)

### Task 8: Complete partial-success load orchestration

**Description:** Complete `gate/load` by validating configuration/range once, launching the three independent reads concurrently, and returning a timestamped result for each resource without losing successful siblings.

**Acceptance criteria:**

- [x] Valid loads settle budget, spend, and requests independently and return each resource exactly once.
- [x] One or two endpoint failures preserve successful resources with their own `receivedAt` timestamps.
- [x] Missing configuration or invalid dates short-circuit before all network calls; all command variants remain redacted.

**Verification:**

- [x] Run the focused background tests.
- [x] Run `pnpm --filter llm-gate-companion test`.
- [x] Run `pnpm --filter llm-gate-companion check`.

**Dependencies:** Tasks 5, 6, and 7

**Files likely touched:**

- `extensions/llm-gate-companion/background.js`
- `extensions/llm-gate-companion/tests/background.test.js`

**Estimated scope:** Small (2 files)

## Checkpoint 2: Complete data boundary

- [x] Run `pnpm --filter llm-gate-companion test`.
- [x] Run `node --experimental-test-coverage --test extensions/llm-gate-companion/tests/*.test.js` and inspect the spec's coverage targets.
- [x] Search the new extension for key/cookie material and authenticated URL fixtures; confirm none exists.
- [x] Compare every command/result and normalized field against `SPEC-gate-data.md`.

## Phase 3: Documentation and repository integration

### Task 9: Finalize security and data-contract documentation

**Description:** Expand the extension README with its module scope, commands, permissions, local-storage warning, key rotation/removal instructions, endpoint behavior, date rules, and limitations. Align package scripts with the verified test and syntax-check commands.

**Acceptance criteria:**

- [x] README documents every permission, states that local storage is unencrypted, and explains how to replace/remove a key without showing a real key.
- [x] README identifies reversed dates as invalid and explains partial endpoint failures.
- [x] Package scripts run the complete test suite, syntax checks, and built-in coverage report without adding dependencies.

**Verification:**

- [x] Run `pnpm --filter llm-gate-companion test`.
- [x] Run `pnpm --filter llm-gate-companion check`.
- [x] Review README examples for secrets and misleading authentication headers.

**Dependencies:** Task 8

**Files likely touched:**

- `extensions/llm-gate-companion/README.md`
- `extensions/llm-gate-companion/package.json`

**Estimated scope:** Small (2 files)

### Task 10: Validate, package, and register the module

**Description:** Run the repository integration workflow, synchronize the generated extension registry, inspect the resulting changes, and verify the distributable ZIP structure and exclusions. Fix only `gate-data` conformance failures.

**Acceptance criteria:**

- [x] Extension validation and packaging succeed with `manifest.json` at the ZIP root.
- [x] Packaged output excludes tests, documentation, metadata, dependencies, and all secret material while retaining required runtime modules and the icon.
- [x] Registry synchronization adds only the expected LLM Gate Companion entry and icon copy.

**Verification:**

- [x] Run `pnpm extension:validate llm-gate-companion`.
- [x] Run `pnpm extension:package llm-gate-companion` and inspect with `unzip -l artifacts/llm-gate-companion-v0.1.0.zip`.
- [x] Run `pnpm extension:sync`, then inspect `git diff --check` and the complete repository diff.

**Dependencies:** Task 9

**Files likely touched:**

- `extensions/llm-gate-companion/extension.config.json`
- `packages/extension-registry/generated/extensions.json`
- `apps/web/public/extensions/llm-gate-companion/icon.png`

**Estimated scope:** Medium (3 files plus generated artifact verification)

## Final Checkpoint: `gate-data` ready for review

- [x] All ten tasks and both intermediate checkpoints are complete.
- [x] All focused and full tests pass at the required coverage level.
- [x] Syntax, extension validation, packaging, ZIP inspection, and registry synchronization pass.
- [x] No live API call was made and no real key/cookie appears anywhere in the diff or artifact.
- [x] Every `gate-data` success criterion is demonstrated by a test or packaging check.
- [ ] Human reviews the completed module before specification begins for the next capability-map module.
