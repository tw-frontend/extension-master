/**
 * Bridge between the popup and the inspected page's localStorage.
 *
 * The popup document has its own localStorage, so we can't touch the page's
 * directly. Instead we inject small, self-contained functions into the active
 * tab with `chrome.scripting.executeScript`. Injected functions run in the
 * content-script world, which shares the page's origin (and therefore its
 * localStorage), and may only depend on their serialized `args`.
 */
import type { PageScan, SazehEntry } from "./types";

const PREFIX = "tw-sazeh-";
const SCHEMA_SUFFIX = "__schema";
const TTL_KEY = "ttl";
const STALE_KEY = "staleAt";
/** How far ahead to push `staleAt` so SWR revalidation won't clobber an override. */
const PIN_STALE_MS = 365 * 24 * 60 * 60 * 1000;

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Runs in the page. Collects every `tw-sazeh-*` config entry + its schema. */
function readEntries(
  prefix: string,
  schemaSuffix: string,
  ttlKey: string,
  staleKey: string
): SazehEntry[] {
  const out: SazehEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix) || key.endsWith(schemaSuffix)) continue;

    const raw = localStorage.getItem(key);
    if (raw == null) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    let value: unknown = parsed;
    const meta: SazehEntry["meta"] = {};
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const isEnvelope = ttlKey in obj || staleKey in obj;
      if (isEnvelope) {
        value = "value" in obj ? obj.value : parsed;
        if (typeof obj[ttlKey] === "number") meta.ttl = obj[ttlKey] as number;
        if (typeof obj[staleKey] === "number")
          meta.staleAt = obj[staleKey] as number;
      }
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) continue;

    let schema: SazehEntry["schema"];
    const schemaRaw = localStorage.getItem(key + schemaSuffix);
    if (schemaRaw) {
      try {
        schema = JSON.parse(schemaRaw);
      } catch {
        /* descriptor is best-effort */
      }
    }

    out.push({ key, value: value as Record<string, unknown>, meta, schema });
  }
  return out;
}

/** Runs in the page. Writes `config` back, optionally pinning staleAt forward. */
function writeEntry(
  key: string,
  config: Record<string, unknown>,
  ttlKey: string,
  staleKey: string,
  pinStale: boolean,
  pinStaleMs: number
): boolean {
  const raw = localStorage.getItem(key);
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }

  const wasEnvelope =
    !!parsed && (ttlKey in parsed || staleKey in parsed);

  if (wasEnvelope || pinStale) {
    const env: Record<string, unknown> = { value: config };
    // Keep a hard TTL only if it hasn't already expired.
    if (parsed && typeof parsed[ttlKey] === "number" && (parsed[ttlKey] as number) > Date.now()) {
      env[ttlKey] = parsed[ttlKey];
    }
    if (pinStale) {
      env[staleKey] = Date.now() + pinStaleMs;
    } else if (parsed && typeof parsed[staleKey] === "number") {
      env[staleKey] = parsed[staleKey];
    }
    localStorage.setItem(key, JSON.stringify(env));
  } else {
    localStorage.setItem(key, JSON.stringify(config));
  }
  return true;
}

/** Runs in the page. */
function removeEntry(key: string): boolean {
  localStorage.removeItem(key);
  return true;
}

async function run<Args extends unknown[], Result>(
  tabId: number,
  func: (...args: Args) => Result,
  args: Args
): Promise<Result> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: func as (...a: unknown[]) => unknown,
    args,
  });
  return injection?.result as Result;
}

export async function scanActiveTab(): Promise<PageScan> {
  const tab = await activeTab();
  if (!tab?.id) return { url: null, entries: [], empty: true };

  try {
    const entries = await run(tab.id, readEntries, [
      PREFIX,
      SCHEMA_SUFFIX,
      TTL_KEY,
      STALE_KEY,
    ]);
    return {
      url: tab.url ?? null,
      entries: entries ?? [],
      empty: !entries || entries.length === 0,
    };
  } catch {
    // executeScript throws on restricted pages (chrome://, web store, etc.).
    return { url: tab.url ?? null, entries: [], empty: true };
  }
}

export async function saveOverride(
  key: string,
  config: Record<string, unknown>,
  pinStale: boolean
): Promise<void> {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active tab to write to.");
  await run(tab.id, writeEntry, [
    key,
    config,
    TTL_KEY,
    STALE_KEY,
    pinStale,
    PIN_STALE_MS,
  ]);
}

export async function clearOverride(key: string): Promise<void> {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active tab to clear.");
  await run(tab.id, removeEntry, [key]);
}

export async function reloadActiveTab(): Promise<void> {
  const tab = await activeTab();
  if (tab?.id) await chrome.tabs.reload(tab.id);
}
