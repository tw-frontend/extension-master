# LLM Gate Companion — 0.2.0

Chromium extension for private Simra LLM Gate budget and usage data.

Clicking the toolbar icon opens a dashboard for API-key setup, current Jalali billing-month progress, remaining budget, date-ranged spend and requests, rankings, and most-used models. OpenRouter model recommendations remain a separate capability tracked by the initiative capability map.

## Data contract

The background service worker accepts four internal extension commands:

| Command | Purpose | Public result |
|---|---|---|
| `gate/configure` | Save or replace the API key | Configuration status only |
| `gate/status` | Check whether a key exists | `{ isConfigured }` only |
| `gate/clear` | Remove the API key immediately | Unconfigured status |
| `gate/load` | Load budget, spend, and request resources | Independently settled, normalized resources |

`gate/load` accepts an inclusive Gregorian `startDate`/`endDate` range in strict `YYYY-MM-DD` format. Missing, impossible, or reversed ranges are rejected locally without a network request; the extension never silently swaps the dates.

The worker calls these read-only endpoints directly:

- `/api/dashboard/budget`
- `/api/dashboard/spend`
- `/api/dashboard/requests`

The API key is added through the upstream-required `api_key` query parameter. Spend and requests also receive `start_date` and `end_date`. Requests omit browser credentials, cookies, caching, and copied browser-identification headers.

Each response is validated before snake-case upstream fields are normalized to camel case. If one dashboard endpoint fails, its error remains isolated and the other successful resources remain available. The data boundary deliberately preserves rank and model-count values without interpreting known inconsistencies.

## Security baseline

- The extension requests only local extension storage and `https://llm.simra.cloud/*` host access.
- It does not request cookies, tabs, scripting, or content-script permissions.
- A configured API key will live in `chrome.storage.local`, which is persistent but not encrypted.
- The popup-facing status and load contracts never return the saved key. Request URLs and upstream response bodies are never logged or included in errors.
- Replacing a key uses `gate/configure`; removing it uses `gate/clear`. The popup exposes both actions without putting the current key back into the page.
- Never reuse the API key included in discovery notes; rotate it before configuring the finished extension.

The package is marked `beta` while live API compatibility is validated. Configure the key only through the extension popup.

## Development

Run from the repository root:

```bash
pnpm --filter llm-gate-companion test
pnpm --filter llm-gate-companion coverage
pnpm --filter llm-gate-companion check
pnpm extension:validate llm-gate-companion
pnpm extension:package llm-gate-companion
```

Automated tests use sanitized fixtures and injected browser/network fakes. They never call Simra. A manual live check requires explicit approval and a newly rotated key entered through the completed extension UI.

For an unpacked development install, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this directory.
