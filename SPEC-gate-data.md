# Spec: LLM Gate Companion — `gate-data`

Status: Approved on 2026-09-09  
Capability map: [`CAPABILITY-MAP-llm-gate-companion.md`](./CAPABILITY-MAP-llm-gate-companion.md)

## Assumptions

1. The extension targets Chromium Manifest V3 browsers: Chrome, Edge, and Brave.
2. The Simra dashboard endpoints accept the API key only as the `api_key` query parameter; no cookies, bearer header, or browser-identification headers are required.
3. `start_date` and `end_date` use Gregorian ISO calendar dates in `YYYY-MM-DD` form and are inclusive.
4. A date range with `start_date` later than `end_date` is invalid and must not trigger a network request.
5. The API key is stored locally for this personal extension. `chrome.storage.local` is persistent but not encrypted, so the UI and documentation must state that limitation.
6. The API key exposed in the discovery cURL is compromised and will not be used in fixtures, tests, source code, commits, or live verification.
7. Rank semantics and the mismatch between `total_requests` and `requests_by_model[].count` are downstream `usage-insights` questions. This module preserves validated upstream values without interpreting them.

## Objective

Provide the trusted boundary between the LLM Gate Companion extension and `https://llm.simra.cloud`. The module owns secret persistence, input validation, HTTP requests, runtime response validation, normalization, and predictable errors. Downstream modules receive documented camel-case objects and never build authenticated URLs themselves.

User stories:

- As the extension owner, I can save a gate API key once, replace it, determine whether one is configured, and remove it.
- As a data consumer, I can request the current remaining budget.
- As a data consumer, I can request spend and request analytics for one valid inclusive date range.
- As a UI consumer, I receive stable, machine-readable failures for missing configuration, invalid input, authentication/authorization failure, rate limiting, timeout, network failure, malformed upstream data, and other HTTP failures.
- As the API-key owner, I do not see the key returned to the popup, logged, embedded in error messages, or stored in cached response objects.

## Upstream API Contract

Base URL: `https://llm.simra.cloud`

| Operation | Request | Required upstream fields |
|---|---|---|
| Remaining budget | `GET /api/dashboard/budget?api_key={encodedKey}` | `remaining_budget: finite number` |
| Spend analytics | `GET /api/dashboard/spend?api_key={encodedKey}&start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}` | `total_spend`, `avg_daily_spend`, `spend_over_time[]`, `spend_by_model[]` |
| Request analytics | `GET /api/dashboard/requests?api_key={encodedKey}&start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}` | `total_requests`, `requests_over_time[]`, `requests_by_model[]`, `avg_spend_per_request`, `rank_by_avg_spend`, `rank_by_spend`, `total_users`, `total_users_spend`, `user_rank` |

Request rules:

- Construct URLs with `URL` and `URLSearchParams`; never concatenate or interpolate an unencoded key into a URL string.
- Use `credentials: "omit"`, `cache: "no-store"`, `Accept: application/json`, and a 10-second timeout.
- Do not send the analytics cookies or copied browser headers from the discovery cURL.
- Validate the HTTP status and JSON shape before normalization.
- Do not retry automatically in this module. Read-only UI refresh orchestration may retry later without risking duplicate writes, but rate-limit and timeout policy belongs to the consuming service worker.

## Internal Interface

The extension service worker is the only layer that loads the stored key and calls the client. Popup callers use messages that never expose the secret:

```js
/** @typedef {{ startDate: string, endDate: string }} DateRange */

/**
 * @typedef
 *   {{ type: "gate/configure"; apiKey: string }
 *   | { type: "gate/clear" }
 *   | { type: "gate/status" }
 *   | { type: "gate/load"; range: DateRange }} GateCommand
 */

/**
 * @typedef
 *   {{ ok: true, data: unknown, receivedAt: string }
 *   | { ok: false, error: {
 *       code: "NOT_CONFIGURED" | "INVALID_API_KEY" | "INVALID_DATE_RANGE" |
 *         "UNAUTHORIZED" | "RATE_LIMITED" | "TIMEOUT" | "NETWORK_ERROR" |
 *         "INVALID_RESPONSE" | "UPSTREAM_ERROR",
 *       message: string,
 *       retryable: boolean,
 *       httpStatus?: number
 *     } }} GateResult
 */
```

`gate/status` returns only `{ isConfigured: boolean }`. `gate/load` returns independently settled `budget`, `spend`, and `requests` results so one failed endpoint does not hide successful data from the others.

Normalized data uses camel-case names while preserving values:

```js
const requestAnalytics = {
  totalRequests: 874,
  requestsOverTime: [{ date: "2026-09-02", count: 563 }],
  requestsByModel: [{ model: "glm-5.3-flash", count: 22716 }],
  averageSpendPerRequest: 0.010850737312013716,
  rankByAverageSpend: 29,
  rankBySpend: 10,
  totalUsers: 34,
  totalUsersSpend: 34,
  userRank: 20,
};
```

No list ordering is promised by the boundary. Consumers must sort explicitly for presentation.

## Tech Stack

- Chromium Manifest V3 service worker
- Dependency-free modern JavaScript ES modules with JSDoc contracts
- Browser `fetch`, `URL`, `URLSearchParams`, `AbortSignal`, and `chrome.storage.local`
- Node.js 20+ built-in test runner for unit and contract tests

The module introduces no production or development dependency. This matches the existing dependency-free `openrouter-deals` extension and keeps packaged permissions and supply-chain surface small.

## Commands

Commands are run from the repository root after the extension package exists:

```bash
pnpm --filter llm-gate-companion test
pnpm --filter llm-gate-companion check
pnpm extension:validate llm-gate-companion
pnpm extension:package llm-gate-companion
```

Manual development: open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `extensions/llm-gate-companion/`.

## Project Structure

```text
extensions/llm-gate-companion/
├── background.js                 # MV3 command boundary and endpoint orchestration
├── src/gate/client.js            # URL construction, fetch, timeout, HTTP mapping
├── src/gate/contracts.js         # Runtime validators and response normalization
├── src/gate/date-range.js        # Strict Gregorian ISO range validation
├── src/gate/key-store.js         # API-key persistence without secret disclosure
├── tests/gate-client.test.js     # HTTP and URL contract tests using mocked fetch
├── tests/gate-contracts.test.js  # Upstream parsing and malformed-response tests
├── tests/gate-date-range.test.js # Date validation edge cases
└── tests/gate-key-store.test.js  # Persistence, replacement, clearing, redaction
```

`gate-data` may add the package, manifest, and metadata shell required to validate the extension, but it does not implement dashboard UI, Jalali calculations, ranking interpretation, charts, or OpenRouter recommendations.

## Code Style

- ES modules and named exports.
- `camelCase` for internal values; upstream snake-case names appear only in contract parsing and query parameters.
- Small pure validators and normalizers; browser APIs are injected or wrapped so tests do not require Chrome.
- Braces for every conditional, semicolons, two-space indentation, and double-quoted strings.
- Errors are values at the command boundary, not unstructured exception strings.

```js
export function validateDateRange({ startDate, endDate }) {
  if (!isGregorianIsoDate(startDate) || !isGregorianIsoDate(endDate)) {
    return failure("INVALID_DATE_RANGE", "Use YYYY-MM-DD dates.", false);
  }

  if (startDate > endDate) {
    return failure(
      "INVALID_DATE_RANGE",
      "Start date must be on or before end date.",
      false,
    );
  }

  return { ok: true, data: { startDate, endDate } };
}
```

## Testing Strategy

Use `node --test` with deterministic fixtures derived from the provided responses but containing no real API key or cookies.

- Unit-test leap years, impossible dates, missing dates, and reversed ranges.
- Verify query values are percent-encoded and that no request is made for invalid input or missing configuration.
- Verify only the intended headers and fetch options are sent.
- Test every documented HTTP/error mapping, timeout behavior, invalid JSON, missing fields, non-finite numbers, and malformed array entries.
- Verify keys can be saved, replaced, detected, and removed, but are never returned by status/load results or included in errors.
- Verify a partial endpoint failure still returns successful sibling resources.
- Use an integration-style service-worker test with mocked Chrome storage and mocked fetch.

Coverage target: 100% branch coverage for date validation, key redaction, upstream contract validators, and error mapping. Other `gate-data` code must maintain at least 90% statement coverage.

Live calls are not part of automated tests. A later manual test must use a newly rotated key supplied through the extension UI, never through a committed fixture or shell history.

## Boundaries

- **Always:** validate user input and every upstream response; URL-encode query values; omit credentials; redact secrets from errors; use no-store requests; permit partial endpoint success; run module tests and extension validation before review.
- **Ask first:** change the Simra base URL or endpoint paths; add dependencies; change storage from `chrome.storage.local`; add automatic retries; add new host permissions; make a live request with a real key.
- **Never:** commit or log API keys/cookies; return the stored key to popup code; put a key in test snapshots or error messages; silently swap reversed dates; interpret inconsistent analytics fields; send inference requests; use remotely hosted scripts.

## Success Criteria

- Saving a valid non-empty key makes `gate/status` report configured without returning the key.
- Clearing the key makes subsequent loads fail locally with `NOT_CONFIGURED` and zero network requests.
- A valid inclusive range produces correctly encoded budget, spend, and requests URLs and normalized camel-case results matching the supplied fixtures.
- Invalid, impossible, or reversed dates produce `INVALID_DATE_RANGE` and zero network requests.
- Each upstream response is rejected as `INVALID_RESPONSE` when a required field has the wrong type, is missing, or contains a non-finite numeric value.
- Authentication, rate-limit, timeout, network, and generic upstream failures use the documented stable error codes and do not contain the key.
- If one endpoint fails, the load result retains the two successful endpoint results.
- Tests meet the stated coverage targets and `pnpm extension:validate llm-gate-companion` succeeds.

## Open Questions

1. Does the Simra server use `401`, `403`, or another status for an invalid API key? Until verified, both `401` and `403` map to `UNAUTHORIZED`.
2. Does the API impose a maximum permitted date span? Until documented, the client validates calendar correctness and ordering only.
3. Are the date boundaries definitively inclusive? The supplied sample suggests this, but the backend contract has not been independently confirmed.
