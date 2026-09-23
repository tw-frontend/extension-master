import { benchmarkFor, overallScore } from './model-quality.js';
import { DEFAULT_PRIORITIES, rankBalanced, rankByPreferences } from './preferences.js';
import { speedFor } from './speed-ranks.js';
import { eligibleCatalog } from './model-eligibility.js';
import { analysisFor } from './artificial-analysis.js';

export const DEFAULT_SETTINGS = {
  input: 1000,
  output: 1000,
  includeFree: true,
  priorities: { ...DEFAULT_PRIORITIES },
};
export const FRESH_MS = 6 * 60 * 60 * 1000;
function groupByModel(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (groups.has(row.id)) groups.get(row.id).push(row);
    else groups.set(row.id, [row]);
  }
  return [...groups.values()];
}
export function amount(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function matches(override, now, input, ignoreTime = false) {
  if (
    override.min_prompt_tokens != null &&
    !(input > override.min_prompt_tokens)
  )
    return false;
  if (ignoreTime) return true;
  const day = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][now.getUTCDay()];
  if (override.utc_days && !override.utc_days.includes(day)) return false;
  const time = now.getUTCHours() * 100 + now.getUTCMinutes();
  const start = override.utc_start ?? 0,
    end = override.utc_end ?? 2400;
  return start <= end
    ? time >= start && time < end
    : time >= start || time < end;
}
const timed = (o) =>
  o.utc_start != null || o.utc_end != null || o.utc_days != null;
export function quote(pricing, settings, now = new Date()) {
  if (!pricing) return null;
  const current = { ...pricing },
    regular = { ...pricing };
  for (const override of pricing.overrides ?? []) {
    for (const key of ["prompt", "completion"]) {
      if (override[key] == null) continue;
      if (!timed(override) && matches(override, now, settings.input))
        regular[key] = override[key];
      if (matches(override, now, settings.input)) current[key] = override[key];
    }
  }
  const input = amount(current.prompt),
    output = amount(current.completion);
  const request = amount(current.request ?? 0);
  const regIn = amount(regular.prompt),
    regOut = amount(regular.completion);
  if ([input, output, request, regIn, regOut].includes(null)) return null;
  const cost = input * settings.input + output * settings.output + request;
  const withoutSchedule =
    regIn * settings.input + regOut * settings.output + request;
  // Public prices are already customer prices. Never multiply them by discount again.
  const discount = Number(pricing.discount ?? 0);
  const providerDiscount =
    Number.isFinite(discount) && discount > 0 && discount < 1 ? discount : 0;
  const standard = withoutSchedule / (1 - providerDiscount);
  const percent =
    standard > cost && standard > 0 ? (1 - cost / standard) * 100 : 0;
  return {
    input,
    output,
    request,
    cost,
    standard,
    percent,
    providerDiscount,
    scheduled: cost < withoutSchedule,
    discounted: percent > 0.000001,
  };
}
export function recommendations(
  state,
  settings = DEFAULT_SETTINGS,
  now = new Date(),
) {
  const rows = [];
  const freeRows = [];
  let checked = 0;
  const models = eligibleCatalog(state.models ?? []);
  for (const model of models) {
    const detail = state.details?.[model.id];
    const fresh = detail && now.getTime() - detail.at < FRESH_MS;
    if (fresh) checked++;
    const candidates = [];
    if (fresh) {
      for (const endpoint of detail.endpoints) {
        if (endpoint.status !== 0) continue;
        if (
          endpoint.max_prompt_tokens != null &&
          settings.input > endpoint.max_prompt_tokens
        )
          continue;
        if (
          endpoint.max_completion_tokens != null &&
          settings.output > endpoint.max_completion_tokens
        )
          continue;
        if (
          endpoint.context_length != null &&
          settings.input + settings.output > endpoint.context_length
        )
          continue;
        const q = quote(endpoint.pricing, settings, now);
        if (q)
          candidates.push({
            ...q,
            provider: endpoint.provider_name || endpoint.name,
            tag: endpoint.tag,
            checkedAt: detail.at,
            verified: true,
            latency_last_30m: endpoint.latency_last_30m,
            throughput_last_30m: endpoint.throughput_last_30m,
          });
      }
    } else if (
      !model.context_length ||
      settings.input + settings.output <= model.context_length
    ) {
      const q = quote(model.pricing, settings, now);
      if (q)
        candidates.push({
          ...q,
          percent: 0,
          discounted: false,
          provider: "Catalog estimate · provider not checked",
          verified: false,
          checkedAt: state.catalogAt,
        });
    }
    for (const candidate of candidates) {
      if (settings.includeFree || candidate.cost > 0 || candidate.cost === 0 && candidate.verified) {
        const scores = benchmarkFor(model, state.benchmarks);
        const analysis = analysisFor(model, state.artificialAnalysis);
        const row = {
          ...candidate,
          id: model.id,
          name: model.name,
          popularityRank: model.popularityRank ?? Number.MAX_SAFE_INTEGER,
          analysis,
          quality: analysis?.intelligence ?? overallScore(scores),
          speedScore: speedFor(model, state.speedRanks),
          latency: amount(candidate.latency_last_30m?.p50),
          throughput: amount(candidate.throughput_last_30m?.p50),
        };
        if (candidate.cost === 0 && candidate.verified) freeRows.push(row);
        if (settings.includeFree || candidate.cost > 0) rows.push(row);
      }
    }
  }
  const cheapestProvider = group => rankByPreferences(group, { cheaper: true })[0];
  const unique = groupByModel(rows).map(cheapestProvider).filter(Boolean);
  const discounted = rows.filter(row => row.discounted);
  const uniqueDeals = groupByModel(discounted).map(cheapestProvider).filter(Boolean);
  const completeAnalysis = row => Number.isFinite(row.analysis?.intelligence) &&
    Number.isFinite(row.analysis?.speed) && row.analysis.speed > 0 && Number.isFinite(row.analysis?.costPerTask);
  const analysisRows = unique.filter(completeAnalysis);
  const rankingRows = analysisRows.length ? analysisRows : unique;
  const evidenceSource = analysisRows.length ? 'artificial-analysis' : 'openrouter-fallback';
  const analysisDeals = uniqueDeals.filter(completeAnalysis);
  const { best, unavailablePreferences } = rankBalanced(rankingRows);
  const { ranked: deals } = rankBalanced(analysisDeals.length ? analysisDeals : uniqueDeals);
  const baseFree = groupByModel(freeRows).map(cheapestProvider).filter(Boolean);
  const analysisFree = baseFree.filter(row => Number.isFinite(row.analysis?.intelligence) &&
    Number.isFinite(row.analysis?.speed) && row.analysis.speed > 0);
  const freeEvidence = analysisFree.length ? analysisFree : baseFree;
  const freeModels = analysisFree.length
    ? rankByPreferences(freeEvidence, { smarter: true, faster: true })
      .map(row => ({ ...row, freeScore: row.preferenceScore * 100 }))
    : freeEvidence.map(row => ({ ...row, freeScore: (row.quality ?? 0) * 0.65 + (row.speedScore ?? 0) * 35 }))
      .sort((a, b) => b.freeScore - a.freeScore || a.popularityRank - b.popularityRank || a.id.localeCompare(b.id));
  return {
    best,
    deals: deals.slice(0, 6),
    freeModels: freeModels.slice(0, 10),
    checked,
    total: models.length,
    priorities: { cheaper: true, smarter: true, faster: true },
    evidenceSource,
    unavailablePreferences,
  };
}
