import { DEFAULT_SETTINGS, FRESH_MS, family, quote } from './pricing.js';

// Family-level editorial estimates, reviewed 2026-09-08. These are NOT benchmark scores.
// Version eligibility is determined from the full live catalog, not these ratings.
export const REVIEWED = '2026-09-08';
const SERIES = [
  { key: 'glm', re: /^z-ai\/glm-(\d+(?:\.\d+)*)$/, tier: 4, role: 'Planning', why: 'Complex software plans and long agent workflows.' },
  { key: 'glm-flash', re: /^z-ai\/glm-(\d+(?:\.\d+)*)-flash$/, tier: 3, role: 'Coding', why: 'Low-cost implementation, tests and routine agent work.' },
  { key: 'deepseek-pro', re: /^deepseek\/deepseek-v(\d+(?:\.\d+)*)-pro(?:-(\d{4}))?$/, tier: 4, role: 'Planning', why: 'Reasoning and design trade-offs at a moderate cost.' },
  { key: 'deepseek-flash', re: /^deepseek\/deepseek-v(\d+(?:\.\d+)*)-flash(?:-(\d{4}))?$/, tier: 3, role: 'Coding', why: 'Economical coding and repeated implementation tasks.' },
  { key: 'gemini-flash', re: /^google\/gemini-(\d+(?:\.\d+)*)-flash(?:-preview)?$/, tier: 3, role: 'Coding', why: 'Responsive coding with multimodal context.' },
  { key: 'gemini-pro', re: /^google\/gemini-(\d+(?:\.\d+)*)-pro(?:-preview)?$/, tier: 4, role: 'Planning', why: 'Complex reasoning over large, multimodal inputs.' },
  { key: 'mimo', re: /^xiaomi\/mimo-v(\d+(?:\.\d+)*)$/, tier: 3, role: 'Coding', why: 'Budget implementation and multimodal agent tasks.' },
  { key: 'mimo-pro', re: /^xiaomi\/mimo-v(\d+(?:\.\d+)*)-pro$/, tier: 4, role: 'Planning', why: 'Complex engineering and long agent tasks on a budget.' },
  { key: 'sonnet', re: /^anthropic\/claude-sonnet-(\d+(?:\.\d+)*)$/, tier: 4, role: 'Planning', why: 'Codebase reasoning, architecture and multi-step engineering.' },
  { key: 'opus', re: /^anthropic\/claude-opus-(\d+(?:\.\d+)*)$/, tier: 5, role: 'Planning', why: 'Demanding reasoning and critical code review.', premium: 1 },
  { key: 'fable', re: /^anthropic\/claude-fable-(\d+(?:\.\d+)*)$/, tier: 5, role: 'Planning', why: 'Critical refactors and difficult autonomous engineering.', premium: 2 },
];
export function profile(model) {
  for (const series of SERIES) {
    const match = model.id.match(series.re);
    if (match) return { ...series, version: [...match[1].split('.').map(Number), Number(match[2] ?? 0)] };
  }
  return null;
}
function versionCompare(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}
export function eligibleCatalog(catalog) {
  const versions = new Map();
  for (const model of catalog) {
    const p = profile(model);
    if (!p) continue;
    const list = versions.get(p.key) ?? [];
    if (!list.some(v => versionCompare(v, p.version) === 0)) list.push(p.version);
    versions.set(p.key, list.sort((a, b) => versionCompare(b, a)));
  }
  return catalog.slice(0, 200).map((model, i) => ({ ...model, popularityRank: i + 1 }))
    .filter(model => {
      const p = profile(model);
      return p && versions.get(p.key).slice(0, 2).some(v => versionCompare(v, p.version) === 0);
    }).map(model => {
      const p = profile(model);
      return { ...model, generation: versionCompare(versions.get(p.key)[0], p.version) === 0 ? 'Latest in series' : 'One version back' };
    });
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
  // Do not use pre-upgrade unsorted caches as a top-200 catalog.
  const models = state.schema === 2 ? (state.models ?? []) : [];
  const rows = [];
  for (const model of models) {
    const p = profile(model);
    if (!p || !model.generation || !(model.popularityRank <= 200)) continue;
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
    quotes.sort((a, b) => a.cost - b.cost);
    const best = quotes[0];
    const preference = family(model);
    // Compare cost on a logarithmic scale so cheap models cannot erase the capability bar.
    const value = p.tier * 2 - Math.log2(1 + best.cost * 1000) +
      (preference >= 0 ? (4 - preference) * .35 : 0) + (best.discounted ? .4 : 0) +
      (best.latency ? .5 / (1 + best.latency) : 0) + (best.throughput ? .5 * best.throughput / (best.throughput + 100) : 0);
    rows.push({ ...model, ...best, ...p, value, nitro: nitroAdvice(quotes, best) });
  }
  rows.sort((a, b) => b.value - a.value || a.popularityRank - b.popularityRank);
  const distinct = list => list.filter((r, i) => list.findIndex(other => other.key === r.key) === i);
  const planning = distinct(rows.filter(r => r.role === 'Planning' && r.tier < 5)).slice(0, 2);
  const coding = distinct(rows.filter(r => r.role === 'Coding')).slice(0, 3);
  const shortlist = [...planning, ...coding];
  const premium = rows.filter(r => r.tier === 5 && r.cost > Math.max(0, ...shortlist.map(s => s.cost)))
    .sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0) || versionCompare(b.version, a.version) || a.cost - b.cost)[0] ?? null;
  return { shortlist, premium, planning, coding, assessed: models.length, reviewed: REVIEWED };
}
