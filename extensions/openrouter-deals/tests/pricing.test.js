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
  const state = stateFor([['z-ai/glm-5', .004, .5], ['new-provider/better-deal', .001, .5],
    ['another/model', .002, .3]]);
  const result = recommendations(state, DEFAULT_SETTINGS, now);
  assert.equal(result.best.id, 'new-provider/better-deal');
  assert.deepEqual(result.deals.map(r => r.id), ['new-provider/better-deal', 'another/model', 'z-ai/glm-5']);
});
test('without promotions the cheaper preference still selects the lowest request cost', () => {
  const state = stateFor([['z-ai/glm', .1], ['other/cheap', .001, .5], ['google/gemini', .001]]);
  assert.equal(recommendations(state, DEFAULT_SETTINGS, now).best.id, 'other/cheap');
  state.details['other/cheap'].endpoints[0].pricing.prompt = '0';
  assert.equal(recommendations(state, DEFAULT_SETTINGS, now).best.id, 'other/cheap');
});
test('smarter preference ranks benchmark evidence directly', () => {
  const state = stateFor([['strong/model', .002, .2], ['medium/model', .001, .1], ['weak/model', .0001, .9]]);
  state.benchmarks = { byModel: {
    'strong/model': { coding: 90, intelligence: 90, agentic: 90 },
    'medium/model': { coding: 80, intelligence: 80, agentic: 80 },
    'weak/model': { coding: 20, intelligence: 20, agentic: 20 },
  } };
  const result = recommendations(state, { ...DEFAULT_SETTINGS, priorities: { smarter: true } }, now);
  assert.equal(result.best.id, 'strong/model');
  assert.deepEqual(result.deals.map(row => row.id), ['strong/model', 'medium/model', 'weak/model']);
  assert.equal(result.qualityFloor, undefined);
});
test('faster preference ranks endpoint speed and excludes missing measurements', () => {
  const state = stateFor([
    ['slow/model', .001, .5, 0, 2, 40],
    ['fast/model', .004, .2, 0, .2, 300],
    ['unknown/model', .0001, .9],
  ]);
  const result = recommendations(state, { ...DEFAULT_SETTINGS, priorities: { faster: true } }, now);
  assert.equal(result.best.id, 'fast/model');
  assert.deepEqual(result.deals.map(row => row.id), ['fast/model', 'slow/model']);
});
test('unavailable providers and over-limit endpoints cannot win', () => {
  const state = stateFor([['z-ai/glm', .001, .5, -2], ['other/ok', .002]]);
  assert.equal(recommendations(state, DEFAULT_SETTINGS, now).best.id, 'other/ok');
  state.details['other/ok'].endpoints[0].max_prompt_tokens = 500;
  assert.equal(recommendations(state, DEFAULT_SETTINGS, now).best, null);
});
test('stale endpoint offers lose promotion status and coverage; free opt-out works', () => {
  const state = stateFor([['z-ai/glm', .01, .5], ['other/free', 0]]);
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
