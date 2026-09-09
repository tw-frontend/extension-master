# Capability Map: LLM Gate Companion

| Module id | Responsibility | Depends on |
|---|---|---|
| `gate-data` | Store and remove the API key, validate date ranges, call the budget/spend/requests endpoints, normalize responses, and report errors | — |
| `model-advisor` | Extract a reusable recommendation engine from `openrouter-deals`, including price, deals, latency, throughput, provider, and Nitro advice | — |
| `usage-insights` | Calculate spending, remaining budget, daily averages, model usage, rankings, optimization metrics, and current Jalali billing-cycle progress | `gate-data` |
| `extension-ui` | Provide onboarding, API-key settings, date filtering, summary cards, charts, rankings, model usage, and daily model recommendations | `usage-insights`, `model-advisor` |

Build order: `gate-data` + `model-advisor` → `usage-insights` → `extension-ui`

Each module follows Specify → Plan → Tasks → Implement in dependency order. The map is the index for module specs; module ids are stable for the lifetime of this initiative.
