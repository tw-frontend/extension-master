import { FRESH_MS } from "./pricing.js";
import { eligibleCatalog, parsePerformance } from "./developer-picks.js";
import { benchmarkFor, normalizeBenchmarks } from './model-quality.js';
import { normalizeApiKey } from './credentials.js';
const API = "https://openrouter.ai/api/v1";
let running;
async function getJSON(path, apiKey = null) {
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
  const response = await fetch(`${API}${path}`, {
    credentials: "omit",
    cache: "no-store",
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = new Error(`OpenRouter returned HTTP ${response.status}`);
    if (response.status === 429) {
      const retry = response.headers.get("Retry-After");
      error.retryAt = Date.now() + 60000;
      if (retry)
        error.retryAt = Math.max(
          error.retryAt,
          /^\d+$/.test(retry)
            ? Date.now() + Number(retry) * 1000
            : Date.parse(retry) || 0,
        );
    }
    throw error;
  }
  const body = await response.json();
  if (!body || body.data == null) throw new Error("Unexpected OpenRouter response");
  return body;
}
export async function scan(force = false) {
  let { state = {}, credentials = {} } = await chrome.storage.local.get(["state", "credentials"]);
  if (!force && state.retryAt > Date.now()) return;
  try {
    if (force || state.schema !== 3 || !state.catalogAt || Date.now() - state.catalogAt >= FRESH_MS) {
      const { data } = await getJSON("/models?output_modalities=text&sort=top-weekly");
      if (!Array.isArray(data) || !data.length)
        throw new Error("Empty or malformed model catalog");
      const models = eligibleCatalog(data);
      state = {
        models,
        schema: 3,
        catalogSize: data.length,
        catalogAt: Date.now(),
        details: {},
        queue: models.map((m) => m.id),
        failures: 0,
        error: null,
        benchmarks: state.benchmarks,
        benchmarkError: state.benchmarkError,
        benchmarkRetryAt: state.benchmarkRetryAt,
      };
      await chrome.storage.local.set({ state });
    }
    let apiKey = '';
    if (credentials.apiKey != null) {
      try { apiKey = normalizeApiKey(credentials.apiKey); }
      catch {
        delete state.benchmarks;
        state.benchmarkError = 'The configured API key is not valid. Discovery mode remains available.';
        state.benchmarkRetryAt = Date.now() + FRESH_MS;
      }
    }
    if (!apiKey && credentials.apiKey == null) {
      delete state.benchmarks;
      delete state.benchmarkError;
      delete state.benchmarkRetryAt;
    } else if (apiKey && (force || !state.benchmarks?.fetchedAt ||
        Date.now() - state.benchmarks.fetchedAt >= FRESH_MS && !(state.benchmarkRetryAt > Date.now()))) {
      try {
        const payload = await getJSON('/benchmarks?source=artificial-analysis&max_results=500', apiKey);
        state.benchmarks = normalizeBenchmarks(payload);
        state.benchmarkError = null;
        state.benchmarkRetryAt = 0;
        state.queue = [...(state.queue ?? [])].sort((a, b) => {
          const left = state.models.find(model => model.id === a);
          const right = state.models.find(model => model.id === b);
          return Number(Boolean(benchmarkFor(right, state.benchmarks))) - Number(Boolean(benchmarkFor(left, state.benchmarks)));
        });
      } catch (error) {
        delete state.benchmarks;
        state.benchmarkError = 'Benchmark evidence could not be loaded. Discovery mode remains available.';
        state.benchmarkRetryAt = error.retryAt ?? Date.now() + FRESH_MS;
      }
      await chrome.storage.local.set({ state });
    }
    const batch = (state.queue ?? []).slice(0, 18);
    for (let start = 0; start < batch.length; start += 6) {
      const ids = batch.slice(start, start + 6);
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const { data } = await getJSON(
            `/models/${id.split("/").map(encodeURIComponent).join("/")}/endpoints`,
          );
          if (!Array.isArray(data.endpoints))
            throw new Error("Malformed endpoint response");
          let performance = [], performanceError = null;
          const model = state.models.find(m => m.id === id);
          if (benchmarkFor(model, state.benchmarks) && data.endpoints.some(e => e.status === 0 &&
              (!e.latency_last_30m?.p50 || !e.throughput_last_30m?.p50))) {
            try {
              const response = await fetch(`https://openrouter.ai/${id.split('/').map(encodeURIComponent).join('/')}`, {
                credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8000),
              });
              if (!response.ok) throw new Error(`Speed page HTTP ${response.status}`);
              performance = parsePerformance(await response.text());
              if (!performance.length) performanceError = 'Provider speed table unavailable';
            } catch (error) { performanceError = error.message; }
          }
          return { at: Date.now(), endpoints: data.endpoints, performance, performanceError };
        }),
      );
      for (let i = 0; i < ids.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          state.details[ids[i]] = result.value;
          state.queue = state.queue.filter((id) => id !== ids[i]);
        } else {
          state.failures = (state.failures ?? 0) + 1;
          state.error = result.reason.message;
          state.retryAt = Math.max(
            state.retryAt ?? 0,
            result.reason.retryAt ?? Date.now() + 60000,
          );
          // Move failed models to the back, retaining them for a later retry.
          state.queue = [...state.queue.filter((id) => id !== ids[i]), ids[i]];
        }
      }
      await chrome.storage.local.set({ state });
      if (state.retryAt > Date.now()) break;
    }
    if (!state.queue?.length) {
      state.error = null;
      state.retryAt = 0;
    }
    await chrome.storage.local.set({ state });
    await chrome.action.setBadgeText({ text: state.queue?.length ? "…" : "" });
  } catch (error) {
    await chrome.storage.local.set({
      state: {
        ...state,
        error: error.message,
        retryAt: error.retryAt ?? Date.now() + 60000,
      },
    });
  }
}
function run(force = false) {
  if (!running)
    running = scan(force).finally(() => {
      running = null;
    });
  return running;
}
async function ensureAlarm() {
  if (!(await chrome.alarms.get("scan")))
    await chrome.alarms.create("scan", { periodInMinutes: 1 });
}
chrome.runtime.onInstalled.addListener(() => {
  void ensureAlarm();
  void run();
});
chrome.runtime.onStartup.addListener(() => {
  void ensureAlarm();
  void run();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "scan") void run();
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === "refresh" || message.type === 'credentialsChanged') {
    void run(Boolean(message.force));
    respond({ ok: true });
  }
});
void ensureAlarm();
