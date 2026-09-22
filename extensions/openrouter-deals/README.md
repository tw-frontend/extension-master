# OpenRouter Daily Deals — 1.3.0

A dependency-free Chromium extension that evaluates OpenRouter's weekly top
200 text models. Each user customizes **Developer picks** and **Daily deals**
with three combinable preferences:

- **Cheaper** — lower estimated request cost ranks higher.
- **Smarter** — stronger OpenRouter benchmark evidence ranks higher.
- **Faster** — lower time to first token and higher output throughput rank
  higher.

There are no separate recommendation modes, hardcoded provider orders, or
model-family allowlists. Select one, two, or all three preferences; selected
choices receive equal weight and persist in the browser profile.

## Install or upgrade

1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load
   unpacked**.
2. Select the folder containing `manifest.json`.
3. When upgrading, click the extension's **Reload** button.
4. Open the popup. Old saved settings remain valid and default to Cheaper until
   the user chooses another combination.
5. Optional: open **Smarter preference data** and add a dedicated, limited
   OpenRouter key if you want benchmark-backed rankings.

The source is the build; there is no bundling step. The first complete provider
scan normally takes around 12 minutes and resumes automatically while Chrome is
running.

## Ranking contract

The worker fetches
`GET /api/v1/models?output_modalities=text&sort=top-weekly`, takes the first 200
entries, then removes aliases, automatic routers, and malformed records. Every
remaining provider and family is eligible.

For each selected preference, the extension normalizes current evidence across
eligible models:

| Preference | Evidence | Better score |
| --- | --- | --- |
| Cheaper | Estimated input, output, and request fees | Lower cost |
| Smarter | Mean available coding, intelligence, and agentic indices | Higher benchmark |
| Faster | Median first-token latency and output throughput | Lower latency, higher throughput |

A model must have evidence for every selected preference. This is deliberate:
missing data cannot become an advantage, and the extension never silently
ignores one of the user's choices. Dimension scores are averaged with equal
weight. Request cost, weekly popularity, and model ID break exact ties.

Developer Picks shows the five highest-ranked matches. Daily Deals uses the
same preferences for its highlighted model and for ordering verified discounted
models. Provider selection inside a model also respects Cheaper and Faster.

## Smarter preference and API-key boundary

The optional OpenRouter key is a data source, not a mode switch. It lets the
worker read `GET /api/v1/benchmarks?source=artificial-analysis`. Records are
validated, minimized, and joined only by exact model slug or canonical slug.
Model names and marketing descriptions are never used as intelligence proxies.

The key is stored under a dedicated credentials record in
`chrome.storage.local`, which is local to the browser profile but is **not an
encrypted secret vault**. Use a dedicated key with a conservative limit.

- The saved value is never rendered back into the popup.
- It is sent only to OpenRouter's benchmark endpoint.
- It never enters recommendation state, errors, logs, URLs, or generated
  metadata.
- Removing it deletes the credential and benchmark cache.
- Authentication, rate-limit, malformed-response, or network failures do not
  block catalog, price, or provider scanning.

If Smarter is selected without benchmark evidence, a Smarter-only selection
shows a missing-data state. Combined selections show provisional results ranked
by the available selected evidence, with a clear notice that intelligence has
not been assessed. Adding a key enables the complete combined ranking.

## Prices, discounts, and speed

Provider details come from
`GET /api/v1/models/{author}/{slug}/endpoints`. Published prompt and completion
prices are USD per token and already include provider discounts. The UI
multiplies them by one million for display and derives an undiscounted reference
price only when the API exposes a discount fraction.

Conditional pricing supports strict prompt-token thresholds, UTC weekdays, and
half-open time windows, including overnight windows. Later matching overrides
win per field. Permanently free models and context surcharges are not labeled
as promotions.

API latency and throughput medians are preferred. When Faster is selected and
an endpoint metric is missing, the worker may parse the public provider table
without executing its scripts. A row must uniquely match provider name and
current input/output prices; otherwise performance remains unavailable.

Nitro compares the selected provider with the highest measured output
throughput. It never claims to improve model intelligence or startup latency.

## Refresh and limitations

The worker scans up to 18 models per alarm, six concurrently, and checkpoints
after each group. Catalog, benchmark, and endpoint data refresh every six
hours. HTTP 429 responses respect `Retry-After`; benchmark backoff is isolated
from anonymous catalog and price updates.

Benchmarks and performance metrics cover fewer models than the catalog and can
lag new releases. Prices, provider availability, reasoning tokens, caching,
long-context surcharges, and non-text charges can change actual cost.
Recommendations are evidence-based comparisons, not guarantees of task
success.

Sources: [Models API](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties),
[Benchmarks API](https://openrouter.ai/docs/api/api-reference/benchmarks/list-benchmarks),
[Endpoints API](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model),
[provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).

## Files and verification

- `preferences.js`: preference validation, normalization, and shared ranking.
- `developer-picks.js`: top-200 candidate and provider selection.
- `pricing.js`: price overrides and personalized Daily Deals.
- `model-quality.js`: benchmark validation and exact matching.
- `background.js`: catalog, benchmark, and provider refresh with backoff.
- `credentials.js`: API-key boundary validation.
- `popup.*`: accessible preference controls, cards, and settings UI.
- `tests/`: ranking, pricing, benchmark, credential, and recovery coverage.

Run with Node 20 or newer:

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
node --check credentials.js
node --check model-quality.js
node --check preferences.js
node --check developer-picks.js
```
