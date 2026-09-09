# LLM Gate Companion — 0.1.0

Work-in-progress Chromium extension for private Simra LLM Gate budget and usage data.

This first module establishes the extension shell and will provide a validated data boundary for budget, spend, and request analytics. Jalali billing insights, dashboard UI, and OpenRouter model recommendations are separate capabilities tracked by the initiative capability map.

## Security baseline

- The extension requests only local extension storage and `https://llm.simra.cloud/*` host access.
- It does not request cookies, tabs, scripting, or content-script permissions.
- A configured API key will live in `chrome.storage.local`, which is persistent but not encrypted.
- Never reuse the API key included in discovery notes; rotate it before configuring the finished extension.

## Development

Run from the repository root:

```bash
pnpm --filter llm-gate-companion test
pnpm --filter llm-gate-companion coverage
pnpm --filter llm-gate-companion check
pnpm extension:validate llm-gate-companion
pnpm extension:package llm-gate-companion
```

For an unpacked development install, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this directory.
