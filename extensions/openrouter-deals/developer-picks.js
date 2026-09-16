import { DEFAULT_SETTINGS, FRESH_MS, quote } from './pricing.js';
import { benchmarkFor, overallScore } from './model-quality.js';
import { normalizePriorities, rankByPreferences } from './preferences.js';

export function eligibleCatalog(catalog) {
  return (Array.isArray(catalog) ? catalog : []).slice(0, 200)
    .map((model, index) => ({ ...model, popularityRank: index + 1 }))
    .filter(model => typeof model.id === 'string' && model.id && model.pricing &&
      !model.alias_target && !model.id.startsWith('openrouter/') && !model.id.startsWith('~'));
}
const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
export function performance(endpoint, detail) {
  const scrape = (detail.performance ?? []).filter(row =>
    row.provider === normalizeProvider(endpoint.provider_name) &&
    Math.abs(row.input - Number(endpoint.pricing.prompt) * 1e6) < 0.00001 &&
    Math.abs(row.output - Number(endpoint.pricing.completion) * 1e6) < 0.00001);
  const row = scrape.length === 1 ? scrape[0] : null;
  return {
    latency: positive(endpoint.latency_last_30m?.p50) ?? row?.latency ?? null,
    throughput: positive(endpoint.throughput_last_30m?.p50) ?? row?.throughput ?? null,
  };
}
export function normalizeProvider(name = '') {
  return name.toLowerCase().replace(/novitaai/g, 'novita').replace(/reka ai/g, 'reka')
    .replace(/google ai studio/g, 'google ai studio').replace(/[^a-z0-9]/g, '');
}
const plain = html => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
// Read only server-rendered tables. Never execute page scripts or parse private frontend data.
export function parsePerformance(html) {
  const results = [];
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows = [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
    const header = [...(rows.shift() ?? '').matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => plain(m[1]));
    const latencyIndex = header.findIndex(h => /^Latency$/i.test(h));
    const throughputIndex = header.findIndex(h => /^Throughput$/i.test(h));
    const inputIndex = header.findIndex(h => /^Input\s*\/M$/i.test(h));
    const outputIndex = header.findIndex(h => /^Output\s*\/M$/i.test(h));
    if ([latencyIndex, throughputIndex, inputIndex, outputIndex].includes(-1)) continue;
    for (const row of rows) {
      const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => plain(m[1]));
      const label = row.match(/aria-label="Open ([^"]+) details"/i)?.[1];
      if (!label) continue;
      const price = cell => {
        const numbers = [...(cell ?? '').matchAll(/\$\s*([\d.]+)/g)];
        return numbers.length ? Number(numbers.at(-1)[1]) : NaN;
      };
      const lat = cells[latencyIndex]?.match(/^([\d.]+)\s*(ms|s)$/);
      const tps = cells[throughputIndex]?.match(/^([\d.]+)\s*(?:tps|tok\/s)$/);
      const input = price(cells[inputIndex]), output = price(cells[outputIndex]);
      if (!Number.isFinite(input) || !Number.isFinite(output)) continue;
      results.push({ provider: normalizeProvider(label), input, output,
        latency: lat ? positive(Number(lat[1]) / (lat[2] === 'ms' ? 1000 : 1)) : null,
        throughput: tps ? positive(Number(tps[1])) : null });
    }
  }
  return results;
}
export function nitroAdvice(quotes, base) {
  const measured = quotes.filter(q => q.throughput);
  if (!base.throughput || measured.length < 2) return { text: 'Unknown — insufficient provider speed data.' };
  const fast = measured.reduce((a, b) => a.throughput > b.throughput ? a : b);
  const gain = fast.throughput / base.throughput;
  const multiplier = base.cost ? fast.cost / base.cost : fast.cost ? Infinity : 1;
  const verdict = gain < 1.25 ? 'Not worthwhile now' : multiplier <= 2.25 ? 'Worth considering for long outputs' : 'Only if speed outweighs cost';
  return { text: `${verdict}: ${Math.round(fast.throughput)} tok/s via ${fast.provider}; ${Number.isFinite(multiplier) ? multiplier.toFixed(1) + '×' : 'higher'} request cost.`, fast };
}
export function developerPicks(state, settings = DEFAULT_SETTINGS, now = new Date()) {
  const models = state.schema === 3 ? (state.models ?? []) : [];
  const priorities = normalizePriorities(settings.priorities);
  const rows = [];
  for (const model of models) {
    if (!(model.popularityRank <= 200)) continue;
    const detail = state.details?.[model.id];
    if (!detail || +now - detail.at >= FRESH_MS) continue;
    const quotes = detail.endpoints.filter(e => e.status === 0 &&
      (!e.context_length || settings.input + settings.output <= e.context_length) &&
      (!e.max_prompt_tokens || settings.input <= e.max_prompt_tokens) &&
      (!e.max_completion_tokens || settings.output <= e.max_completion_tokens))
      .map(e => {
        const q = quote(e.pricing, settings, now);
        return q && { ...q, ...performance(e, detail), provider: e.provider_name || e.name, tag: e.tag };
      }).filter(q => q && (settings.includeFree || q.cost > 0));
    if (!quotes.length) continue;
    const providerPriorities = {
      cheaper: priorities.cheaper || !priorities.faster,
      smarter: false,
      faster: priorities.faster,
    };
    const best = rankByPreferences(quotes.map((row, index) => ({
      ...row, id: `${model.id}:${index}`, popularityRank: index + 1,
    })), providerPriorities)[0];
    const scores = benchmarkFor(model, state.benchmarks);
    rows.push({ ...model, ...best, id: model.id, popularityRank: model.popularityRank,
      scores, quality: overallScore(scores), nitro: nitroAdvice(quotes, best) });
  }
  const benchmarked = rows.filter(row => row.quality != null).length;
  const picks = rankByPreferences(rows, priorities).slice(0, 5);
  return {
    picks,
    shortlist: picks,
    assessed: models.length,
    benchmarked,
    priorities,
    benchmarkAsOf: benchmarked ? state.benchmarks?.asOf ?? null : null,
  };
}
