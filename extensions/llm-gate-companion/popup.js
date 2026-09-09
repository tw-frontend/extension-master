import { buildDashboardSummary, getJalaliMonthStatus } from "./src/popup-model.js";

const byId = (id) => document.getElementById(id);
const setupView = byId("setup-view");
const dashboardView = byId("dashboard-view");
const connectionStatus = byId("connection-status");
const setupForm = byId("setup-form");
const setupError = byId("setup-error");
const apiKeyInput = byId("api-key");
const rangeForm = byId("range-form");
const startDateInput = byId("start-date");
const endDateInput = byId("end-date");
const refreshButton = byId("refresh-button");
const dashboardError = byId("dashboard-error");
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const send = (message) => chrome.runtime.sendMessage(message);

function setConnection(label, state = "") {
  connectionStatus.textContent = label;
  connectionStatus.className = `connection ${state}`.trim();
}

function setError(element, message) {
  element.textContent = message ?? "";
  element.hidden = !message;
}

function showSetup(message = "") {
  dashboardView.hidden = true;
  setupView.hidden = false;
  setConnection("Setup needed");
  setError(setupError, message);
  apiKeyInput.focus();
}

function showDashboard() {
  setupView.hidden = true;
  dashboardView.hidden = false;
  setConnection("Connected", "ready");
}

const setText = (id, value) => { byId(id).textContent = value; };
const formatMoney = (value) => value === null ? "—" : currency.format(value);
const formatCount = (value) => value === null ? "—" : integer.format(value);

function rankLabel(rank, totalUsers) {
  if (rank === null) return "—";
  return totalUsers === null ? `#${rank}` : `#${rank} / ${totalUsers}`;
}

function renderModels(models) {
  const list = byId("model-list");
  list.replaceChildren();
  setText("model-count", models.length ? `${models.length} models` : "");
  if (!models.length) {
    const empty = document.createElement("p");
    empty.className = "model-empty";
    empty.textContent = "No model usage in this date range.";
    list.append(empty);
    return;
  }

  const maximum = Math.max(...models.map((model) => model.spend || model.requests), 1);
  for (const model of models.slice(0, 6)) {
    const row = document.createElement("div");
    row.className = "model-row";
    const bar = document.createElement("span");
    bar.className = "model-bar";
    bar.style.width = `${Math.max(4, ((model.spend || model.requests) / maximum) * 100)}%`;
    const content = document.createElement("div");
    content.className = "model-content";
    const name = document.createElement("span");
    name.className = "model-name";
    name.textContent = model.model;
    name.title = model.model;
    const usage = document.createElement("span");
    usage.className = "model-usage";
    usage.textContent = `${formatMoney(model.spend)} · ${formatCount(model.requests)} req`;
    content.append(name, usage);
    row.append(bar, content);
    list.append(row);
  }
}

function renderDashboard(resources) {
  const summary = buildDashboardSummary(resources);
  setText("total-spend", formatMoney(summary.totalSpend));
  setText("remaining-budget", formatMoney(summary.remainingBudget));
  setText("total-requests", formatCount(summary.totalRequests));
  setText("daily-average", formatMoney(summary.averageDailySpend));
  setText("optimization-rank", rankLabel(summary.optimizationRank, summary.totalUsers));
  setText("overall-rank", rankLabel(summary.overallRank, summary.totalUsers));
  renderModels(summary.models);
  setError(dashboardError, summary.errors.join(" "));
  setText("updated-at", `Updated ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date())}`);
}

async function loadDashboard() {
  refreshButton.disabled = true;
  setConnection("Refreshing…");
  setError(dashboardError, "");
  try {
    const result = await send({ type: "gate/load", range: { startDate: startDateInput.value, endDate: endDateInput.value } });
    if (!result?.ok) {
      setConnection("Could not refresh", "error");
      setError(dashboardError, result?.error?.message ?? "The dashboard could not be loaded.");
      return;
    }
    renderDashboard(result.data);
    setConnection("Connected", "ready");
  } catch {
    setConnection("Could not refresh", "error");
    setError(dashboardError, "The extension background service is unavailable. Reopen the popup and try again.");
  } finally {
    refreshButton.disabled = false;
  }
}

setupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = setupForm.querySelector("button[type='submit']");
  submit.disabled = true;
  setError(setupError, "");
  setConnection("Saving…");
  try {
    const result = await send({ type: "gate/configure", apiKey: apiKeyInput.value });
    if (!result?.ok) {
      setError(setupError, result?.error?.message ?? "The API key could not be saved.");
      setConnection("Setup needed", "error");
      return;
    }
    apiKeyInput.value = "";
    showDashboard();
    await loadDashboard();
  } catch {
    setError(setupError, "The extension background service is unavailable.");
    setConnection("Setup failed", "error");
  } finally {
    submit.disabled = false;
  }
});

rangeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (startDateInput.value > endDateInput.value) {
    setError(dashboardError, "Start date must be on or before end date.");
    return;
  }
  await loadDashboard();
});

byId("clear-key").addEventListener("click", async () => {
  try {
    const result = await send({ type: "gate/clear" });
    showSetup(result?.ok ? "" : "The saved API key could not be removed.");
  } catch {
    setError(dashboardError, "The saved API key could not be removed.");
  }
});

async function initialize() {
  const month = getJalaliMonthStatus();
  startDateInput.value = month.startDate;
  endDateInput.value = month.endDate;
  startDateInput.max = month.endDate;
  endDateInput.max = month.endDate;
  setText("jalali-label", month.label);
  setText("days-remaining", String(month.daysRemaining));
  setText("month-caption", `Day ${month.day} of ${month.daysInMonth} · ${month.progressPercent}% elapsed`);
  byId("month-progress").style.width = `${month.progressPercent}%`;
  try {
    const status = await send({ type: "gate/status" });
    if (!status?.ok || !status.data.isConfigured) {
      showSetup(status?.ok ? "" : status?.error?.message);
      return;
    }
    showDashboard();
    await loadDashboard();
  } catch {
    showSetup("The extension background service is unavailable. Reload the extension and try again.");
    setConnection("Unavailable", "error");
  }
}

initialize();
