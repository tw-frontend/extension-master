# OpenRouter Daily Deals

A dependency-free Chromium extension that evaluates OpenRouter's weekly top
200 text models from OpenAI, Anthropic, Z.ai, Xiaomi, Qwen, Google and DeepSeek. Each user customizes **Developer picks** with three combinable
preferences:

- **Cheaper** — lower estimated request cost ranks higher.
- **Smarter** — stronger OpenRouter benchmark evidence ranks higher.
- **Faster** — lower time to first token and higher output throughput rank
  higher.

**Daily deals** always recommends a balanced model independently of these
checkboxes. Each recognizable model family is limited to its two newest
versions in the weekly top 200 (for example, Opus 5 and 4.8). **Top free** lists
verified zero-cost models from the same pool, ranked by quality and speed.
Selected choices receive equal weight in Developer Picks and persist in the
browser profile.

## Install or upgrade

1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load
   unpacked**.
2. Select the folder containing `manifest.json`.
3. When upgrading, click the extension's **Reload** button.
4. Open the popup. Old saved settings remain valid and default to Cheaper until
   the user chooses another combination.
5. Optional: open **Additional benchmark data** and add a dedicated, limited
   OpenRouter key for a separate benchmark refresh. Smarter works from public
   catalog benchmark scores without a key.

The source is the build; there is no bundling step. The first complete provider
scan normally takes around 12 minutes and resumes automatically while Chrome is
running.

## Ranking contract

The worker fetches
`GET /api/v1/models?output_modalities=text&sort=top-weekly`, takes the first 200
entries, then removes aliases, malformed records, makers outside the requested
seven, and older versions within each recognizable model family. The original
top-200 cutoff is applied before filtering, and newer versions outside that
cutoff do not replace weekly favorites.

For each selected preference, the extension normalizes current evidence across
eligible models:

| Preference | Evidence | Better score |
| --- | --- | --- |
| Cheaper | Estimated input, output, and request fees | Lower cost |
| Smarter | Mean available coding, intelligence, and agentic indices in the public catalog | Higher benchmark |
| Faster | Public model ordering by latency and throughput; provider measurements when available | Higher relative speed rank |

A model must have evidence for every selected preference. This is deliberate:
missing data cannot become an advantage, and the extension never silently
ignores one of the user's choices. Dimension scores are averaged with equal
weight. Request cost, weekly popularity, and model ID break exact ties.

Developer Picks shows the five highest-ranked matches. Daily Deals uses a fixed
50% quality, 30% speed, 20% cost balance. The highlighted model comes from the
stronger quality half, outside the slowest speed quarter, and below the upper
price quartile among usable models. Verified discounted models are listed
separately.

## Smarter preference and API-key boundary

The public model catalog includes Artificial Analysis benchmark indices. The
optional OpenRouter key refreshes additional records from
`GET /api/v1/benchmarks?source=artificial-analysis`. Records are validated,
minimized, and joined only by exact model slug or canonical slug. Model names
and marketing descriptions are never used as intelligence proxies.

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

If a selected dimension has no evidence, combined Developer Picks show
provisional matches using available selected dimensions. A single choice with
no evidence shows an explicit missing-data state.

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

OpenRouter's public latency and throughput model sort orders supply relative
speed rankings when endpoint medians are missing. They are model comparisons,
not measured seconds or tokens per second for the chosen provider. Endpoint
medians are shown separately when available. If public sort data is unavailable,
the worker may parse the public provider table without executing its scripts.

Nitro compares the selected provider with the highest measured output
throughput. It never claims to improve model intelligence or startup latency.

## Refresh and limitations

The worker scans up to 18 models per alarm, six concurrently, and checkpoints
after each group. Catalog, speed ranking, benchmark, and endpoint data refresh every six
hours. HTTP 429 responses respect `Retry-After`; benchmark backoff is isolated
from anonymous catalog and price updates.

Benchmarks and performance metrics cover fewer models than the catalog and can
lag new releases. Prices, provider availability, reasoning tokens, caching,
long-context surcharges, and non-text charges can change actual cost.
Recommendations are evidence-based comparisons, not guarantees of task
success.

Sources: [Models API](https://openrouter.ai/docs/api/api-reference/models/get-models),
[Benchmarks API](https://openrouter.ai/docs/api/api-reference/benchmarks/get-benchmarks),
[Endpoints API](https://openrouter.ai/docs/api/api-reference/endpoints/list-endpoints),
[provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).

## Files and verification

- `preferences.js`: preference validation, normalization, and shared ranking.
- `developer-picks.js`: top-200 candidate and provider selection.
- `pricing.js`: price overrides and fixed-balance Daily Deals.
- `speed-ranks.js`: public latency and throughput order normalization.
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
