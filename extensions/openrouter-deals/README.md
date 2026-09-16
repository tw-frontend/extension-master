# OpenRouter Daily Deals — 1.2.0

A dependency-free Chromium extension that evaluates OpenRouter's weekly top
200 text models. It provides **Developer picks** and **Daily deals** without a
hardcoded provider order or model-family allowlist.

## Two honest modes

**Discovery mode** requires no credentials. It recommends models only from
evidence the extension can observe directly:

- weekly OpenRouter usage;
- the eligible provider price for your request size;
- median time to first token and output throughput when available;
- advertised context length; and
- active provider or scheduled discounts.

**Intelligent mode** is optional. A locally stored OpenRouter API key lets the
worker read OpenRouter's benchmark endpoint and add purpose-specific evidence
for:

1. coding and debugging;
2. planning and architecture;
3. agentic execution;
4. quality-adjusted value; and
5. critical work, where capability outranks price.

The same model may lead more than one purpose. The extension does not replace a
winner with a weaker model merely to create five different cards.

## Install or upgrade

1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load
   unpacked**.
2. Select the folder containing `manifest.json`.
3. When upgrading, click the extension's **Reload** button.
4. Open the popup. Old ranking caches migrate automatically to schema 3 and a
   fresh top-200 provider scan begins.
5. Optional: open **Optional Intelligent mode** and paste a dedicated,
   limited OpenRouter key.

The source is the build; there is no bundling step. The first complete provider
scan normally takes around 12 minutes and resumes automatically while Chrome is
running.

## Ranking contract

The worker fetches
`GET /api/v1/models?output_modalities=text&sort=top-weekly`, takes the first 200
entries, then removes aliases, automatic routers and malformed records. Every
remaining provider and family is eligible. Popularity defines the candidate
universe; it is not treated as an intelligence score.

With a key, `GET /api/v1/benchmarks?source=artificial-analysis` supplies coding,
intelligence and agentic indices. Records are validated, minimized and joined
only by exact model slug or canonical slug. Unknown or missing scores stay
missing. Model names and marketing descriptions are never used as substitutes
for benchmark evidence.

Purpose scores use these weights:

| Purpose | Primary evidence | Supporting evidence |
| --- | --- | --- |
| Coding | 60% coding | 25% agentic, 15% intelligence |
| Planning | 55% intelligence | 35% agentic, 10% coding |
| Agentic | 60% agentic | 25% coding, 15% intelligence |
| Value | Average available benchmark evidence | Logarithmic request-cost penalty |
| Critical | Average available benchmark evidence | Price only breaks ties |

If a supporting index is missing, the available weights are renormalized. A
model must have the purpose's primary index to lead that purpose.

Daily Deals considers the same full candidate pool. In Intelligent mode, the
highlighted recommendation must be at or above the median benchmark quality of
the currently eligible, benchmark-covered models. This stops a deeply
discounted but weak model from being presented as the best deal. The complete
discount list remains visible and labels models below the recommendation floor.
Discovery mode ranks verified promotion percentage, request cost and weekly
popularity without making a capability claim.

## API key and security boundary

The API key is optional. It is stored under a dedicated credentials record in
`chrome.storage.local`, which is local to the browser profile but is **not an
encrypted secret vault**. Use a dedicated key with a conservative limit.

- The saved key is never rendered back into the popup.
- It is sent only to `https://openrouter.ai/api/v1/benchmarks` in the
  `Authorization` header.
- It is never placed in recommendation state, errors, logs, URLs or generated
  metadata.
- Removing the key deletes the credential and benchmark-derived cache.
- A 401, 429, malformed response or network failure falls back to Discovery
  mode without blocking price and provider scanning.

The extension makes no inference requests and includes no content scripts,
analytics or remotely executed code. Host access remains limited to
`https://openrouter.ai/*`.

## Prices, discounts and speed

Provider details come from
`GET /api/v1/models/{author}/{slug}/endpoints`. Published prompt and completion
prices are USD per token and already include provider discounts. The UI
multiplies them by one million for display and derives the undiscounted
reference price only when the API exposes a discount fraction.

Conditional pricing supports strict prompt-token thresholds, UTC weekdays and
half-open time windows, including overnight windows. Later matching overrides
win per field. Permanently free models and context surcharges are not labeled
as promotions.

API latency and throughput medians are preferred. For benchmark-covered models
whose API metrics are missing, the worker may parse the public provider table
without executing its scripts. A row must uniquely match provider name and
current input/output prices; otherwise performance remains unavailable.

Nitro compares the cheapest eligible provider with the highest measured output
throughput. It never claims to improve model intelligence or startup latency.

## Refresh and limitations

The worker scans up to 18 models per alarm, six concurrently, and checkpoints
after each group. Catalog, benchmark and endpoint data refresh every six hours.
HTTP 429 responses respect `Retry-After`; benchmark backoff is isolated so it
cannot stop anonymous catalog and price updates. Chrome alarms may be delayed
during sleep and do not run while Chrome is closed.

Benchmarks cover fewer models than the OpenRouter catalog and can lag new
releases. Prices, provider availability, reasoning tokens, caching, long-context
surcharges and non-text charges can change actual cost. Recommendations are
evidence-based comparisons, not guarantees of task success.

Sources: [Models API](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties),
[Benchmarks API](https://openrouter.ai/docs/api/api-reference/benchmarks/list-benchmarks),
[Endpoints API](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model),
[provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).

## Files and verification

- `background.js`: catalog, benchmark and provider refresh, queueing and backoff.
- `model-quality.js`: benchmark validation, exact matching and purpose scores.
- `developer-picks.js`: Intelligent and Discovery recommendation policies.
- `pricing.js`: price overrides and Daily Deals ranking.
- `credentials.js`: API-key boundary validation.
- `popup.*`: accessible mode, cards and settings UI.
- `tests/`: ranking, pricing, benchmark, credential and recovery coverage.

Run with Node 20 or newer:

```text
node tests/credentials.test.js
node tests/model-quality.test.js
node tests/pricing.test.js
node tests/background.test.js
node tests/developer-picks.test.js
node --check background.js
node --check popup.js
node --check pricing.js
node --check credentials.js
node --check model-quality.js
node --check developer-picks.js
```
