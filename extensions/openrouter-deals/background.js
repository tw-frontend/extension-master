import { family, FRESH_MS } from "./pricing.js";
import { eligibleCatalog, parsePerformance } from "./developer-picks.js";
const API = "https://openrouter.ai/api/v1";
let running;
async function getJSON(path) {
  const response = await fetch(`${API}${path}`, {
    credentials: "omit",
    cache: "no-store",
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
  if (!body.data) throw new Error("Unexpected OpenRouter response");
  return body.data;
}
export async function scan(force = false) {
  let { state = {} } = await chrome.storage.local.get("state");
  if (state.retryAt > Date.now()) return;
  try {
    if (force || state.schema !== 2 || !state.catalogAt || Date.now() - state.catalogAt >= FRESH_MS) {
      const data = await getJSON("/models?output_modalities=text&sort=top-weekly");
      if (!Array.isArray(data) || !data.length)
        throw new Error("Empty or malformed model catalog");
      const models = data.slice(0, 200).map((m, index) => ({ ...m, popularityRank: index + 1 })).filter(
        (m) =>
          m.id &&
          m.pricing &&
          !m.alias_target &&
          !m.id.startsWith("openrouter/") &&
          !m.id.startsWith("~"),
      );
      const eligible = new Map(eligibleCatalog(data).map(m => [m.id, m]));
      models.forEach(m => Object.assign(m, eligible.get(m.id) ?? {}));
      models.sort(
        (a, b) =>
          Number(Boolean(b.generation)) - Number(Boolean(a.generation)) ||
          (family(a) < 0 ? 99 : family(a)) - (family(b) < 0 ? 99 : family(b)) ||
          a.id.localeCompare(b.id),
      );
      state = {
        models,
        schema: 2,
        catalogSize: data.length,
        catalogAt: Date.now(),
        details: {},
        queue: models.map((m) => m.id),
        failures: 0,
        error: null,
      };
      await chrome.storage.local.set({ state });
    }
    const batch = (state.queue ?? []).slice(0, 18);
    for (let start = 0; start < batch.length; start += 6) {
      const ids = batch.slice(start, start + 6);
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const data = await getJSON(
            `/models/${id.split("/").map(encodeURIComponent).join("/")}/endpoints`,
          );
          if (!Array.isArray(data.endpoints))
            throw new Error("Malformed endpoint response");
          let performance = [], performanceError = null;
          const model = state.models.find(m => m.id === id);
          if (model?.generation && data.endpoints.some(e => e.status === 0 &&
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
  if (message.type === "refresh") {
    void run(Boolean(message.force));
    respond({ ok: true });
  }
});
void ensureAlarm();
