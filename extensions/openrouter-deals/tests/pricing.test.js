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
  return { catalogAt: +now, models: items.map(([id]) => ({ id, name: id, pricing })),
    details: Object.fromEntries(items.map(([id, cost, discount = 0, status = 0]) => [id, { at: +now, endpoints: [
      { status, provider_name: 'Test', pricing: { prompt: String(cost), completion: String(cost), discount } }
    ] }])) };
}
test('discounted favorites rank GLM > DeepSeek > Gemini > MiMo regardless of cheaper alternatives', () => {
  const state = stateFor([['other/free', 0], ['xiaomi/mimo', .001, .2], ['google/gemini', .002, .3],
    ['deepseek/v4', .003, .4], ['z-ai/glm-5', .004, .5]]);
  const result = recommendations(state, DEFAULT_SETTINGS, now);
  assert.equal(result.best.id, 'z-ai/glm-5');
  assert.deepEqual(result.deals.map(r => r.family), [0, 1, 2, 3]);
});
test('without discounted favorites cheapest overall wins, with preference tie breaks', () => {
  const state = stateFor([['z-ai/glm', .1], ['other/cheap', .001, .5], ['google/gemini', .001]]);
  assert.equal(recommendations(state, DEFAULT_SETTINGS, now).best.id, 'google/gemini');
  state.details['other/cheap'].endpoints[0].pricing.prompt = '0';
  assert.equal(recommendations(state, DEFAULT_SETTINGS, now).best.id, 'other/cheap');
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
