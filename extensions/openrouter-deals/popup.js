import {
  DEFAULT_SETTINGS,
  FRESH_MS,
  recommendations,
  FAMILIES,
} from "./pricing.js";
import { developerPicks } from './developer-picks.js';
const $ = (id) => document.getElementById(id);
const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumSignificantDigits: 4,
  }).format(value);
const percent = (value) => `${value.toFixed(1).replace(/\.0$/, "")}%`;
let state = {},
  settings = { ...DEFAULT_SETTINGS };
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
function render() {
  renderDeveloperPicks();
  $("date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
  const result = recommendations({ ...state, models: state.schema === 2 ? state.models?.filter(m => m.generation) : [] }, settings);
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
        `${row.discounted && row.family >= 0 ? `${FAMILIES[row.family]} has an active offer and leads by your preference order.` : "Lowest estimated cost among current eligible prices; your favorites break ties."} ${row.verified ? `Provider checked ${new Date(row.checkedAt).toLocaleString()}. Use the listed provider to seek this price; automatic routing may cost more.` : "Catalog estimate only; provider discount coverage is pending."}`,
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
      : "No other verified discounts for your current preferences.";
}
function pickCard(row) {
  const card = element('article', null, 'pick-card');
  card.append(element('span', `${row.role} · ${row.tier === 5 ? 'Premium' : row.tier === 4 ? 'Higher' : 'Medium'} capability estimate`, 'eyebrow'),
    element('h3', row.name), element('p', `#${row.popularityRank} weekly · ${row.generation}${row.created ? " · " + new Date(row.created * 1000).toLocaleDateString() : ""}`, 'provider'),
    element('p', row.why, 'pick-reason'));
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
  $('pick-count').textContent = `${picks.shortlist.length}/5 ready`;
  $('picks-status').textContent = state.schema !== 2 ? 'Updating the catalog for the new top-200 filter…' :
    `${state.models?.filter(m => m.generation).length ?? 0} models match the reviewed families and recency rule. ${state.queue?.length ? 'Scanning providers; picks may change.' : ''}${picks.shortlist.length < 5 ? ' Fewer than five eligible, verified quotes are currently available.' : ''}`;
  $('developer-list').replaceChildren(...picks.shortlist.map(pickCard));
  $('premium-pick').replaceChildren(picks.premium ? pickCard(picks.premium) : element('p', 'No qualifying premium quote yet. It will appear after eligible providers are checked.', 'muted'));
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
  };
  await chrome.storage.local.set({ settings });
  $("saved").textContent = "Saved";
  render();
});
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
  }
});
try {
  const saved = await chrome.storage.local.get(["state", "settings"]);
  state = saved.state ?? {};
  settings = { ...DEFAULT_SETTINGS, ...saved.settings };
  $("input").value = settings.input;
  $("output").value = settings.output;
  $("free").checked = settings.includeFree;
  render();
  await chrome.runtime.sendMessage({ type: "refresh" });
} catch {
  $("status").textContent =
    "Unable to load extension storage. Reload the extension and try again.";
}
setInterval(render, 15000);
