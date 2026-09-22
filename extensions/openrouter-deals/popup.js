import {
  DEFAULT_SETTINGS,
  FRESH_MS,
  recommendations,
} from "./pricing.js";
import { developerPicks } from './developer-picks.js';
import { normalizeApiKey } from './credentials.js';
import { normalizePriorities } from './preferences.js';
const $ = (id) => document.getElementById(id);
const PRIORITY_LABELS = { cheaper: 'Cheaper', smarter: 'Smarter', faster: 'Faster' };
const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumSignificantDigits: 4,
  }).format(value);
const percent = (value) => `${value.toFixed(1).replace(/\.0$/, "")}%`;
let state = {},
  settings = { ...DEFAULT_SETTINGS },
  credentialStatus = { configured: false };
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function link(row, text = row.name) {
  const node = element("a", text);
  node.href = `https://openrouter.ai/${row.id.split("/").map(encodeURIComponent).join("/")}`;
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  return node;
}
function priorityText(priorities) {
  return Object.entries(normalizePriorities(priorities))
    .filter(([, selected]) => selected).map(([key]) => PRIORITY_LABELS[key]).join(' + ');
}
function missingEvidenceText(keys) {
  return keys.map(key => PRIORITY_LABELS[key]).join(' and ');
}
function scoreText(row) {
  return Object.entries(row.preferenceBreakdown ?? {})
    .map(([key, score]) => `${PRIORITY_LABELS[key]} ${Math.round(score * 100)}%`).join(' · ');
}
function render() {
  renderDeveloperPicks();
  $("date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
  const result = recommendations({ ...state, models: state.schema === 3 ? state.models : [] }, settings);
  $('priority-summary').textContent = priorityText(result.priorities).toUpperCase();
  const stale = !state.catalogAt || Date.now() - state.catalogAt >= FRESH_MS;
  const progress = `${result.checked}/${result.total} models checked for provider offers`;
  const time = state.catalogAt
    ? new Date(state.catalogAt).toLocaleString()
    : "never";
  $("status").textContent =
    `${stale ? "Prices need refreshing. " : ""}${progress}. Catalog: ${time}.${state.queue?.length ? " Scan in progress; recommendation is provisional." : ""}${state.error ? ` Last fetch failed: ${state.error}. Retrying automatically; showing available data.` : ""}`;
  $("refresh").disabled = Boolean(
    state.queue?.length && !state.error && !stale,
  );
  $("count").textContent = `${result.deals.length} found`;
  $('deal-evidence').textContent = result.unavailablePreferences.length
    ? result.best
      ? `Provisional: ${missingEvidenceText(result.unavailablePreferences)} evidence is unavailable. Ranked by ${priorityText(result.best.matchedPreferences)}.${result.unavailablePreferences.includes('smarter') ? ' Add an OpenRouter key to include Smarter.' : ''}`
      : `No ${missingEvidenceText(result.unavailablePreferences)} evidence is available for the selected ranking.`
    : '';
  $("best").replaceChildren();
  const row = result.best;
  if (!row)
    $("best").append(
      element(
        "p",
        "No eligible prices yet. Refresh or adjust your token estimate.",
      ),
    );
  else {
    $("best").append(
      element("h2", row.name),
      element("div", row.provider, "provider"),
      element(
        "span",
        row.discounted
          ? `${percent(row.percent)} off${row.scheduled ? " · active time window" : " · provider offer"}`
          : row.cost === 0
            ? "Free · no verified promotion"
            : "No verified promotion",
        "badge",
      ),
    );
    const prices = element("div", null, "prices");
    for (const [label, price] of [
      ["Input / 1M tokens", row.input],
      ["Output / 1M tokens", row.output],
    ]) {
      const block = element("div");
      block.append(
        element("strong", money(price * 1e6)),
        element("small", label),
      );
      prices.append(block);
    }
    $("best").append(
      prices,
      element(
        "p",
        `${money(row.cost)} / estimated request${row.request ? ` (includes ${money(row.request)} request fee)` : ""}.${row.discounted ? ` Reference without offer: ${money(row.standard)} / request (derived).` : ""}`,
        "estimate",
      ),
    );
    $("best").append(
      element(
        "p",
        `${result.unavailablePreferences.length ? 'Provisional fit' : 'Preference fit'} ${Math.round(row.preferenceScore * 100)}%: ${scoreText(row)}. ${row.verified ? `Provider checked ${new Date(row.checkedAt).toLocaleString()}. Use the listed provider to seek this price; automatic routing may cost more.` : "Catalog estimate only; provider discount coverage is pending."}`,
        "reason",
      ),
      link(row, "View model & providers ↗"),
    );
  }
  $("deals").replaceChildren();
  const others = result.deals.filter((deal) => deal.id !== row?.id).slice(0, 5);
  for (const deal of others) {
    const li = element("li"),
      block = element("div", null, "row");
    block.append(
      link(deal),
      element(
        "p",
        `${money(deal.input * 1e6)} in / ${money(deal.output * 1e6)} out per 1M`,
      ),
      element("p", deal.provider),
    );
    li.append(
      block,
      element("span", `−${percent(deal.percent)}`, "deal-percent"),
    );
    $("deals").append(li);
  }
  $("empty").textContent = others.length
    ? ""
    : result.checked < result.total
      ? "Checking more providers. Other verified offers will appear here."
      : "No other verified discounts for the current eligible models.";
}
function pickCard(row, index, provisional = false) {
  const card = element('article', null, 'pick-card');
  card.append(element('span', `${provisional ? 'PROVISIONAL' : 'MATCH'} ${index + 1} · ${Math.round(row.preferenceScore * 100)}% FIT`, 'eyebrow'),
    element('h3', row.name), element('p', `#${row.popularityRank} weekly${row.created ? " · " + new Date(row.created * 1000).toLocaleDateString() : ""}`, 'provider'),
    element('p', scoreText(row), 'pick-reason'));
  if (row.quality != null) card.append(element('p', `Average available benchmark evidence: ${row.quality.toFixed(1)} / 100.`, 'provider'));
  card.append(element('p', `${money(row.input * 1e6)} input / ${money(row.output * 1e6)} output per 1M tokens`, 'pick-price'),
    element('p', `${money(row.cost)} / your request · ${row.provider}${row.discounted ? ` · ${percent(row.percent)} off` : ''}`, 'provider'));
  card.append(element('p', `Latency: ${row.latency == null ? 'unavailable' : row.latency.toFixed(2) + 's to first token'} · Speed: ${row.throughput == null ? 'unavailable' : Math.round(row.throughput) + ' tok/s'}`, 'pick-speed'),
    element('p', `Nitro: ${row.nitro.text}`, 'pick-nitro'));
  if (row.nitro.fast) card.append(element('p', `Fast provider price: ${money(row.nitro.fast.input * 1e6)} input / ${money(row.nitro.fast.output * 1e6)} output per 1M.`, 'provider'));
  const actions = element('div', null, 'pick-actions');
  const copy = element('button', 'Copy model ID');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(row.id); copy.textContent = 'Copied'; }
    catch { copy.textContent = row.id; }
  });
  actions.append(link(row, 'Model & providers ↗'), copy); card.append(actions);
  return card;
}
function renderDeveloperPicks() {
  const picks = developerPicks(state, settings);
  $('pick-count').textContent = `${picks.picks.length}/5 ${picks.unavailablePreferences.length && picks.picks.length ? 'provisional' : 'ready'}`;
  const smartSelected = picks.priorities.smarter;
  const evidence = picks.unavailablePreferences.length
    ? picks.picks.length
      ? `No ${missingEvidenceText(picks.unavailablePreferences)} evidence is available. These are provisional matches ranked by ${priorityText(picks.picks[0].matchedPreferences)}.${picks.unavailablePreferences.includes('smarter') ? ' Add an OpenRouter key to include Smarter.' : ''}`
      : `No ${missingEvidenceText(picks.unavailablePreferences)} evidence is available for the selected ranking.${smartSelected ? ' Add an OpenRouter key for Smarter.' : ''}`
    : `Ranking by ${priorityText(picks.priorities)}${smartSelected && picks.benchmarkAsOf ? ` with benchmark data dated ${new Date(picks.benchmarkAsOf).toLocaleDateString()}` : ''}.`;
  $('picks-status').textContent = state.schema !== 3 ? 'Updating the catalog for adaptive top-200 selection…' :
    `${evidence} ${state.queue?.length ? 'Scanning providers; matches may change.' : ''}${state.benchmarkError ? ` ${state.benchmarkError}` : ''}${picks.picks.length < 5 ? ' Some matches are waiting for complete selected evidence.' : ''}`;
  $('developer-list').replaceChildren(...picks.picks.map((row, index) => pickCard(row, index, picks.unavailablePreferences.length > 0)));
}
function renderCredentialStatus(message = '') {
  $('remove-key').disabled = !credentialStatus.configured;
  $('key-status').textContent = message || (credentialStatus.configured
    ? state.benchmarkError || 'A key is configured. The saved value is never shown. Benchmark evidence refreshes automatically.'
    : 'No key configured. Cheaper and Faster remain available; Smarter needs benchmark data.');
}
function clearBenchmarkState() {
  const next = { ...state };
  delete next.benchmarks;
  delete next.benchmarkError;
  delete next.benchmarkRetryAt;
  return next;
}
for (const view of ['picks', 'deals']) {
  $(`show-${view}`).addEventListener('click', () => {
    $('developer-view').hidden = view !== 'picks'; $('deals-view').hidden = view !== 'deals';
    $('show-picks').setAttribute('aria-pressed', String(view === 'picks'));
    $('show-deals').setAttribute('aria-pressed', String(view === 'deals'));
  });
}
$("settings").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!$("settings").reportValidity()) return;
  settings = {
    input: Number($("input").value),
    output: Number($("output").value),
    includeFree: $("free").checked,
    priorities: normalizePriorities(settings.priorities),
  };
  await chrome.storage.local.set({ settings });
  $("saved").textContent = "Saved";
  render();
});
$("api-key-settings").addEventListener("submit", async event => {
  event.preventDefault();
  let saved = false;
  try {
    const apiKey = normalizeApiKey($("api-key").value);
    state = clearBenchmarkState();
    credentialStatus = { configured: true };
    await chrome.storage.local.set({ credentials: { apiKey }, credentialStatus, state });
    saved = true;
    $("api-key").value = '';
    renderCredentialStatus('Key saved without displaying it. Checking benchmark access…');
    render();
  } catch (error) {
    renderCredentialStatus(error.message || 'The key could not be saved.');
  }
  if (!saved) return;
  try { await chrome.runtime.sendMessage({ type: 'credentialsChanged', force: true }); }
  catch { renderCredentialStatus('Key saved, but the background refresh could not start. Use Refresh to retry.'); }
});
$("remove-key").addEventListener("click", async () => {
  state = clearBenchmarkState();
  credentialStatus = { configured: false };
  await chrome.storage.local.remove(['credentials', 'credentialStatus']);
  await chrome.storage.local.set({ state });
  $("api-key").value = '';
  renderCredentialStatus('Key removed. Smarter will wait for benchmark data.');
  render();
  await chrome.runtime.sendMessage({ type: 'credentialsChanged', force: true });
});
function prioritiesFromControls() {
  return {
    cheaper: $('prefer-cheaper').checked,
    smarter: $('prefer-smarter').checked,
    faster: $('prefer-faster').checked,
  };
}
for (const key of Object.keys(PRIORITY_LABELS)) {
  $(`prefer-${key}`).addEventListener('change', async event => {
    const selected = prioritiesFromControls();
    if (!Object.values(selected).some(Boolean)) {
      event.currentTarget.checked = true;
      $('preference-status').textContent = 'Keep at least one preference selected.';
      return;
    }
    settings = { ...settings, priorities: selected };
    await chrome.storage.local.set({ settings });
    $('preference-status').textContent = `${priorityText(selected)} saved.`;
    render();
    if (selected.faster) {
      try { await chrome.runtime.sendMessage({ type: 'preferencesChanged' }); }
      catch { $('preference-status').textContent += ' Speed data will refresh when the background worker resumes.'; }
    }
  });
}
$("refresh").addEventListener("click", async () => {
  $("refresh").disabled = true;
  try {
    await chrome.runtime.sendMessage({ type: "refresh", force: true });
  } catch {
    $("status").textContent =
      "Unable to reach the background worker. Reload the extension.";
  } finally {
    setTimeout(render, 1000);
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.state) {
    state = changes.state.newValue ?? {};
    render();
    renderCredentialStatus();
  }
  if (area === 'local' && changes.credentialStatus) {
    credentialStatus = changes.credentialStatus.newValue ?? { configured: false };
    renderCredentialStatus();
  }
});
try {
  const saved = await chrome.storage.local.get(["state", "settings", "credentialStatus"]);
  state = saved.state ?? {};
  settings = { ...DEFAULT_SETTINGS, ...saved.settings };
  settings.priorities = normalizePriorities(saved.settings?.priorities);
  credentialStatus = saved.credentialStatus ?? { configured: false };
  $("input").value = settings.input;
  $("output").value = settings.output;
  $("free").checked = settings.includeFree;
  for (const [key, selected] of Object.entries(settings.priorities)) $(`prefer-${key}`).checked = selected;
  renderCredentialStatus();
  render();
  await chrome.runtime.sendMessage({ type: "refresh" });
} catch {
  $("status").textContent =
    "Unable to load extension storage. Reload the extension and try again.";
}
setInterval(render, 15000);
