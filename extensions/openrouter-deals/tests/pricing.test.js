import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, matches, recommendations, DEFAULT_SETTINGS, FRESH_MS } from '../pricing.js';
const now = new Date('2026-09-08T02:00:00Z');
const pricing = { prompt: '0.000001', completion: '0.000002', request: '0' };
test('published customer price is not discounted twice; reference is reconstructed', () => {
  const q = quote({ ...pricing, discount: .5 }, DEFAULT_SETTINGS, now);
  assert.equal(q.cost, .003); assert.equal(q.standard, .006); assert.equal(q.percent, 50);
});
test('missing, negative and nonnumeric prices are not treated as free', () => {
  for (const prompt of [undefined, null, '', '-1', 'wat']) assert.equal(quote({ ...pricing, prompt }, DEFAULT_SETTINGS), null);
  assert.equal(quote({ prompt: '0', completion: '0' }, DEFAULT_SETTINGS).cost, 0);
});
test('UTC weekday, overnight and exclusive end conditions', () => {
  const o = { utc_start: 2300, utc_end: 300, utc_days: ['tuesday'] };
  assert.equal(matches(o, now, 1000), true);
  assert.equal(matches(o, new Date('2026-09-08T03:00:00Z'), 1000), false);
  assert.equal(matches(o, new Date('2026-09-09T02:00:00Z'), 1000), false);
  assert.equal(matches({ utc_start: 200, utc_end: 300 }, now, 1000), true);
});
test('context threshold is strictly greater; later overrides win per key', () => {
  const p = { ...pricing, overrides: [{ min_prompt_tokens: 1000, prompt: '.000004' },
    { utc_start: 100, utc_end: 300, prompt: '.0000005' }, { completion: '.000001' }] };
  assert.equal(matches(p.overrides[0], now, 1000), false);
  const q = quote(p, { ...DEFAULT_SETTINGS, input: 1001 }, now);
  assert.equal(q.input, .0000005); assert.equal(q.output, .000001); assert.equal(q.scheduled, true);
  assert.equal(quote(p, DEFAULT_SETTINGS, new Date('2026-09-08T04:00:00Z')).scheduled, false);
});
test('context surcharges and permanently free prices are not promotions', () => {
  assert.equal(quote({ ...pricing, overrides: [{ min_prompt_tokens: 1, prompt: '.001' }] }, DEFAULT_SETTINGS).discounted, false);
  assert.equal(quote({ prompt: '0', completion: '0' }, DEFAULT_SETTINGS).discounted, false);
});
function stateFor(items) {
  return { catalogAt: +now, models: items.map(([id], index) => ({ id, name: id, pricing, popularityRank: index + 1 })),
    details: Object.fromEntries(items.map(([id, cost, discount = 0, status = 0, latency = null, throughput = null]) => [id, { at: +now, endpoints: [
      { status, provider_name: 'Test', pricing: { prompt: String(cost), completion: String(cost), discount },
        latency_last_30m: latency == null ? null : { p50: latency },
        throughput_last_30m: throughput == null ? null : { p50: throughput } }
    ] }])) };
}
test('daily deals rank all providers by evidence without a family preference', () => {
  const state = stateFor([['z-ai/glm-5', .004, .5], ['xiaomi/better-deal', .001, .5],
    ['qwen/model', .002, .3]]);
  const result = recommendations(state, DEFAULT_SETTINGS, now);
  assert.equal(result.best.id, 'xiaomi/better-deal');
  assert.deepEqual(result.deals.map(r => r.id), ['xiaomi/better-deal', 'qwen/model', 'z-ai/glm-5']);
});
test('without promotions the cheaper preference still selects the lowest request cost', () => {
  const state = stateFor([['z-ai/glm', .1], ['google/cheap', .001, .5], ['google/gemini', .001]]);
  assert.equal(recommendations(state, DEFAULT_SETTINGS, now).best.id, 'google/cheap');
  state.details['google/cheap'].endpoints[0].pricing.prompt = '0';
  assert.equal(recommendations(state, DEFAULT_SETTINGS, now).best.id, 'google/cheap');
});
test('Daily Deals balances benchmark evidence against cost even when Smarter is selected', () => {
  const state = stateFor([['openai/model', .002, .2], ['anthropic/model', .001, .1], ['deepseek/model', .0001, .9]]);
  state.benchmarks = { byModel: {
    'openai/model': { coding: 90, intelligence: 90, agentic: 90 },
    'anthropic/model': { coding: 80, intelligence: 80, agentic: 80 },
    'deepseek/model': { coding: 20, intelligence: 20, agentic: 20 },
  } };
  const result = recommendations(state, { ...DEFAULT_SETTINGS, priorities: { smarter: true } }, now);
  assert.equal(result.best.id, 'anthropic/model');
  assert.deepEqual(new Set(result.deals.map(row => row.id)),
    new Set(['openai/model', 'anthropic/model', 'deepseek/model']));
  assert.equal(result.qualityFloor, undefined);
});
test('combined daily choices retain provisional price and speed results without benchmarks', () => {
  const state = stateFor([['z-ai/model', .001, .5, 0, 2, 40], ['google/model', .002, .5, 0, .2, 300]]);
  const result = recommendations(state, { ...DEFAULT_SETTINGS,
    priorities: { cheaper: true, smarter: true, faster: true } }, now);
  assert.ok(result.best);
  assert.equal(result.deals.length, 2);
  assert.deepEqual(result.unavailablePreferences, ['smarter']);
  assert.deepEqual(result.best.matchedPreferences, ['cheaper', 'faster']);
});
test('faster preference ranks endpoint speed and excludes missing measurements', () => {
  const state = stateFor([
    ['qwen/model', .001, .5, 0, 2, 40],
    ['google/model', .004, .2, 0, .2, 300],
    ['xiaomi/model', .0001, .9],
  ]);
  const result = recommendations(state, { ...DEFAULT_SETTINGS, priorities: { faster: true } }, now);
  assert.equal(result.best.id, 'google/model');
  assert.deepEqual(result.deals.map(row => row.id), ['google/model', 'qwen/model']);
});
test('unavailable providers and over-limit endpoints cannot win', () => {
  const state = stateFor([['z-ai/glm', .001, .5, -2], ['google/ok', .002]]);
  assert.equal(recommendations(state, DEFAULT_SETTINGS, now).best.id, 'google/ok');
  state.details['google/ok'].endpoints[0].max_prompt_tokens = 500;
  assert.equal(recommendations(state, DEFAULT_SETTINGS, now).best, null);
});
test('stale endpoint offers lose promotion status and coverage; free opt-out works', () => {
  const state = stateFor([['z-ai/glm', .01, .5], ['google/free', 0]]);
  assert.equal(recommendations(state, { ...DEFAULT_SETTINGS, includeFree: false }, now).best.id, 'z-ai/glm');
  const result = recommendations(state, DEFAULT_SETTINGS, new Date(+now + FRESH_MS));
  assert.equal(result.checked, 0); assert.equal(result.deals.length, 0);
});
test('one model appears once even with multiple discounted providers', () => {
  const state = stateFor([['z-ai/glm', .01, .5]]);
  state.details['z-ai/glm'].endpoints.push({ status: 0, pricing: { prompt: '.001', completion: '.001', discount: .2 } });
  const result = recommendations(state, DEFAULT_SETTINGS, now);
  assert.equal(result.deals.length, 1); assert.equal(result.best.cost, 2);
});
test('Daily Deals ignores Developer Picks checkboxes and favors balanced value over extremes', () => {
  const state = stateFor([
    ['z-ai/weak', .0001, 0, 0, 2, 30],
    ['openai/model', .002, 0, 0, .7, 140],
    ['anthropic/model', .05, 0, 0, .2, 300],
  ]);
  for (const [id, quality] of [['z-ai/weak', 20], ['openai/model', 80], ['anthropic/model', 95]]) {
    state.models.find(model => model.id === id).benchmarks = {
      artificial_analysis: { intelligence_index: quality },
    };
  }
  const results = [{ cheaper: true }, { smarter: true }, { faster: true },
    { cheaper: true, smarter: true, faster: true }].map(priorities =>
    recommendations(state, { ...DEFAULT_SETTINGS, priorities }, now));
  assert.ok(results.every(result => result.best.id === 'openai/model'));
  assert.ok(results.every(result => result.best.preferenceScore === results[0].best.preferenceScore));
});
test('free view ranks verified free models by quality and speed regardless of include-free setting', () => {
  const state = stateFor([
    ['qwen/qwen3.8-27b:free', 0], ['z-ai/glm-5.2:free', 0],
    ['openai/gpt-5.6-sol', .001], ['random/model:free', 0],
  ]);
  state.models[0].benchmarks = { artificial_analysis: { intelligence_index: 90 } };
  state.models[1].benchmarks = { artificial_analysis: { intelligence_index: 70 } };
  state.speedRanks = { byModel: { 'qwen/qwen3.8-27b:free': .65, 'z-ai/glm-5.2:free': .9 } };
  const result = recommendations(state, { ...DEFAULT_SETTINGS, includeFree: false }, now);
  assert.deepEqual(result.freeModels.map(row => row.id),
    ['qwen/qwen3.8-27b:free', 'z-ai/glm-5.2:free']);
  assert.equal(result.best.id, 'openai/gpt-5.6-sol');
  state.details['qwen/qwen3.8-27b:free'].at = +now - FRESH_MS;
  assert.deepEqual(recommendations(state, DEFAULT_SETTINGS, now).freeModels.map(row => row.id),
    ['z-ai/glm-5.2:free']);
});
test('daily and free views never rank excluded makers or older family versions', () => {
  const state = stateFor([
    ['random/very-cheap', 0], ['anthropic/claude-opus-4.6', 0],
    ['anthropic/claude-opus-4.7', 0], ['anthropic/claude-opus-4.8', .001],
    ['anthropic/claude-opus-5', .002],
  ]);
  const result = recommendations(state, DEFAULT_SETTINGS, now);
  assert.equal(result.freeModels.length, 0);
  assert.equal(result.total, 2);
  assert.ok(['anthropic/claude-opus-4.8', 'anthropic/claude-opus-5'].includes(result.best.id));
});
