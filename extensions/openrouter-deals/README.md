# OpenRouter Daily Deals — 1.1.0

A dependency-free Chrome extension with **Developer picks** and **Daily deals** views. No API key or build step required.

## What's new

Developer picks automatically selects **two planning models, three coding models, and one separate premium model** using live prices, discounts, provider speed, your GLM → DeepSeek → Gemini → MiMo preferences, and editorial capability estimates. These are computed recommendations, not the five names from a hardcoded response.

Each card includes its primary role, capability tier, weekly popularity position, recency, input/output prices per million tokens, cost for your selected request size, provider, discount percentage, time to first token, throughput, and a Nitro recommendation with the faster provider's price. Cards link to OpenRouter and can copy the exact model ID.

## Install or upgrade

1. Open `chrome://extensions`, enable **Developer mode**, and click **Load unpacked**.
2. Select the folder containing `manifest.json`.
3. If already installed, click the extension's **Reload** button. Both the workspace root and the existing extracted `openrouter-daily-deals/` folder have been updated to 1.1.0.
4. Open the popup. **Developer picks** is the default tab. Old caches automatically migrate by fetching a fresh, popularity-sorted catalog. Provider cards appear as the scan progresses.

The ZIP contains the same source. Extract it before loading it into Chrome. Settings stay in local Chrome storage; no inference requests are sent. Host access is limited to OpenRouter, with credentials omitted. All code runs locally; no content scripts, analytics, or remote scripts.

## Ranking and recency

- Fetch the entire text catalog using `GET /api/v1/models?output_modalities=text&sort=top-weekly`. Restrict the candidate universe to the **first 200 API entries**, before excluding aliases or automatic routers. This uses popularity as the user's “popular or capable” gate.
- Determine the latest two distinct versions per recognized series from the **full catalog**, so a new version outside the top 200 still makes older versions ineligible. Numeric versions and DeepSeek dated revisions are compared numerically. Flash and Pro are separate series. Model creation dates are displayed but are not used as intelligence scores.
- The reviewed series cover GLM/GLM Flash, DeepSeek Pro/Flash, Gemini Pro/Flash, MiMo/Pro, and Claude Sonnet/Opus/Fable. Unknown series remain unrated and are excluded from recommendations; the UI displays the number of reviewed, eligible models. This is not a claim to benchmark all 200 models.
- `developer-picks.js` contains **editorial family-level estimates**, reviewed September 8, 2026: tier 3 for routine coding, tier 4 for planning, tier 5 for premium work. These are not independent benchmark measurements. New versions inherit their family's estimate and still need periodic editorial review. “Coding” means routine implementation; difficult coding can require a planning/premium model.
- Score within a role: `2 × tier − log2(1 + requestCost × 1000) + preferenceBonus + discountBonus + latencyBonus + throughputBonus`. Preference bonuses are 1.40/1.05/0.70/0.35 for GLM/DeepSeek/Gemini/MiMo; other families receive zero. An active discount adds 0.4. Latency adds `0.5/(1+seconds)` and throughput adds `0.5*tps/(tps+100)` when measurements exist. Missing speed receives no speed bonus and is displayed as unavailable.
- Select two tier-4 planning models and three tier-3 coding models, with **one model per series**. Among eligible provider quotes, use the cheapest for the selected input/output token mix. Price changes can change the list. If fewer than five verified quotes are eligible, show the available count rather than inventing models or using stale prices.
- Select a separate tier-5 premium model that costs more per request than every everyday pick. Editorial premium order currently favors Fable over Opus, then newer versions, then lower cost. This is an explicit recommendation policy, not proof of a universal “absolute best.”
- Daily deals remains available, preserving stronger priority for discounted preferred families. Its recommendations also enforce the reviewed recency filter. The background checks the rest of the top-200 catalog but does not display unreviewed/outdated models as recommendations.

Family descriptions are based on public OpenRouter model pages, including [GLM 5.3](https://openrouter.ai/z-ai/glm-5.3), [GLM Flash](https://openrouter.ai/z-ai/glm-5.3-flash), [DeepSeek Pro](https://openrouter.ai/deepseek/deepseek-v4-pro-0813), [Gemini Flash](https://openrouter.ai/google/gemini-3.8-flash), [MiMo](https://openrouter.ai/xiaomi/mimo-v2.5), and [Claude Fable](https://openrouter.ai/anthropic/claude-fable-5.1). Role and value choices are editorial inferences from these descriptions, not benchmark results.

## Public API, discounts and speed

Verified September 8, 2026:

| Source | Information |
| --- | --- |
| `GET /api/v1/models?output_modalities=text&sort=top-weekly` | Popularity-ordered text catalog, names, prices, creation dates and limits |
| `GET /api/v1/models/{author}/{slug}/endpoints` | Provider prices, discount fractions, overrides, availability and optional median performance |
| `GET /{author}/{slug}` | Public provider table, used only when eligible models lack API speed measurements |

Anonymous catalog and provider requests succeeded during verification, although generated API documentation includes bearer-key examples. Authentication failures are displayed, not interpreted as “no deals.” There is no verified dedicated daily-deals API. The single-model endpoint is not a reliable replacement for endpoint-level discount data.

Published prompt/completion prices are USD **per token** and already reflect provider discounts. Multiply by one million for the display; do not multiply by `(1-discount)` again. Reference prices are **derived**, not independently reported historical prices. Discounts are recognized only when the selected quote is actually cheaper than its applicable reference.

Conditional pricing uses all `pricing.overrides` conditions: strict `min_prompt_tokens` thresholds, UTC weekdays and half-open time windows, including overnight windows. Later matching entries win per key. Time-window prices are treated as published customer prices. Only active price reductions are labeled as time offers. The pricing tests cover this schema behavior; the captured live GLM example had no time overrides.

API latency/throughput fields were null in several live responses. For eligible models, the worker reads the public HTML provider table as a fallback. It extracts column-labelled prices and performance without executing page scripts or reading private frontend endpoints. A table row must uniquely match the endpoint's normalized provider name **and current input/output prices**. Ambiguous rows, failed requests, changed markup, and absent measurements stay unavailable. A speed-page failure never discards successful pricing. API metrics take precedence.

Nitro compares the cheapest eligible quote to the provider with the highest measured output throughput:

- Less than 25% improvement: not worthwhile now.
- At least 25% improvement at no more than 2.25× request cost: worth considering for long outputs.
- Larger price premium: only if speed outweighs cost.
- Insufficient comparable measurements: unknown.

Nitro is `provider.sort: "throughput"` (or the `:nitro` model suffix). It changes routing, not intelligence, and does not guarantee faster first tokens. Use `provider.sort: "latency"` for startup latency. The extension advises but does not change account routing. Provider eligibility and real-time conditions may change the actual route.

Sources: [Models API and units](https://openrouter.ai/docs/guides/overview/models), [Endpoints API](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model), [OpenAPI schema](https://openrouter.ai/openapi.json), [Published discounted pricing](https://openrouter.ai/collections/discounted-models), [Provider discount behavior](https://openrouter.ai/docs/guides/community/for-providers), [Nitro and routing](https://openrouter.ai/docs/guides/routing/provider-selection).

## Refresh, persistence and limitations

The worker scans up to 18 models per alarm, six concurrently. Catalog and endpoint timeouts are 10 seconds; optional provider-page fetches have 8-second timeouts. Each group saves progress. A one-minute alarm resumes pending work, retries failed endpoint requests and respects API HTTP 429 Retry-After backoff. A full scan refreshes every six hours while Chrome runs. Installation, startup and popup opening also check for work. Manual Refresh starts a new scan. Initial top-200 coverage normally takes around 12 minutes, depending on latency; reviewed models and preferred families are checked first.

The popup reevaluates scheduled prices every 15 seconds while open. Provider data older than six hours cannot produce developer picks. The daily-deals view can show clearly labeled catalog estimates while provider coverage is incomplete. Chrome alarms may be delayed during sleep and do not run with Chrome closed. See [Chrome's worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

Costs estimate uncached text input/output and per-request fees. Account settings, provider availability, billed reasoning tokens, caching, long context and non-text charges can affect the bill. A promotion on a provider's own website may not apply to OpenRouter. The extension does not infer promotions from historical price drops and cannot guarantee detection of offers between refreshes.

## Files and verification

- `background.js`: catalog, provider requests, fallback speed fetches, migration, alarms, queue and backoff.
- `pricing.js`: price overrides and daily-deal ranking.
- `developer-picks.js`: reviewed capability estimates, dynamic recency, developer ranking, speed parsing and Nitro evaluation.
- `popup.html`, `popup.css`, `popup.js`: tabs, recommendation cards, premium choice, preferences and refresh.
- `tests/`: pricing, scan recovery/migration, top-200 filtering, recency, ranking, speed parsing and Nitro tests.

Run `npm test` and `npm run check` with Node 20+. No `npm install` is necessary.

Validation: automated tests and syntax checks passed. A headless Chrome smoke test with captured live provider responses and a mocked Chrome bridge verified five cards, the premium card, both tabs and saving token preferences. The speed parser also extracted 25 rows from a live GLM provider page. Real installation and long-running alarm behavior are not covered by the popup smoke test.
