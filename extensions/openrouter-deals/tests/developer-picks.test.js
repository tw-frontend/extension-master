import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleCatalog, developerPicks, parsePerformance, performance, nitroAdvice } from '../developer-picks.js';
import { DEFAULT_SETTINGS, FRESH_MS } from '../pricing.js';
const now = new Date('2026-09-08T12:00:00Z');
const model = id => ({ id, name: id, pricing: { prompt: '.000001', completion: '.000002' } });
test('eligibility checks versions against the full catalog before limiting to top 200', () => {
  const catalog = [model('z-ai/glm-4'), model('z-ai/glm-5.2'), model('z-ai/glm-5.3'),
    ...Array.from({ length: 197 }, (_, i) => model(`unknown/${i}`)), model('z-ai/glm-5.4')];
  assert.deepEqual(eligibleCatalog(catalog).map(m => m.id), ['z-ai/glm-5.3']);
  assert.equal(eligibleCatalog(catalog)[0].generation, 'One version back');
  assert.equal(eligibleCatalog(catalog)[0].popularityRank, 3);
});
test('numeric versions and revisions work; aliases and unknown families are not rated', () => {
  const list = eligibleCatalog(['google/gemini-3.8-flash', 'google/gemini-3.9-flash', 'google/gemini-3.10-flash',
    '~google/gemini-flash-latest', 'deepseek/deepseek-v4-pro', 'deepseek/deepseek-v4-pro-0813'].map(model));
  assert.equal(list.some(m => m.id.includes('3.8')), false);
  assert.equal(list.find(m => m.id.includes('3.10')).generation, 'Latest in series');
  assert.equal(list.find(m => m.id.endsWith('0813')).generation, 'Latest in series');
  assert.equal(list.some(m => m.id.startsWith('~')), false);
});
function fixture() {
  const models = eligibleCatalog(['z-ai/glm-5.3', 'z-ai/glm-5.2', 'deepseek/deepseek-v4-pro-0813',
    'z-ai/glm-5.3-flash', 'deepseek/deepseek-v4-flash-0731', 'xiaomi/mimo-v2.5',
    'google/gemini-3.8-flash', 'anthropic/claude-fable-5.1'].map(model));
  const details = Object.fromEntries(models.map(m => [m.id, { at: +now, endpoints: [{ status: 0, provider_name: 'Test',
    pricing: { prompt: m.id.includes('fable') ? '.00001' : '.000001', completion: m.id.includes('fable') ? '.00005' : '.000002' } }] }]));
  return { schema: 2, models, details };
}
test('five distinct series, two planners, three coders and a separate higher-priced premium', () => {
  const result = developerPicks(fixture(), DEFAULT_SETTINGS, now);
  assert.equal(result.shortlist.length, 5);
  assert.equal(result.planning.length, 2); assert.equal(result.coding.length, 3);
  assert.equal(new Set(result.shortlist.map(r => r.key)).size, 5);
  assert.equal(result.premium.id, 'anthropic/claude-fable-5.1');
  assert.ok(result.shortlist.every(r => r.cost < result.premium.cost));
});
test('live price changes alter selection; stale or unavailable quotes cannot be picks', () => {
  const state = fixture();
  const first = developerPicks(state, DEFAULT_SETTINGS, now);
  const id = first.coding[0].id;
  state.details[id].endpoints[0].pricing = { prompt: '1', completion: '1' };
  assert.notEqual(developerPicks(state, DEFAULT_SETTINGS, now).coding[0].id, id);
  assert.equal(developerPicks(state, DEFAULT_SETTINGS, new Date(+now + FRESH_MS)).shortlist.length, 0);
  state.details[id].endpoints[0].status = -2;
  assert.equal(developerPicks(state, DEFAULT_SETTINGS, now).shortlist.some(r => r.id === id), false);
  state.schema = 1; assert.equal(developerPicks(state, DEFAULT_SETTINGS, now).shortlist.length, 0);
});
test('table parser uses column headers, final discounted prices and milliseconds', () => {
  const html = '<table><tr><th>Provider</th><th>Input /M</th><th>Output /M</th><th>Latency</th><th>Throughput</th></tr>' +
    '<tr><td><button aria-label="Open DeepInfra details">DeepInfra</button></td><td><s>$0.15</s> $0.075</td><td>$0.25</td><td>340 ms</td><td>161 tps</td></tr></table>';
  const rows = parsePerformance(html);
  assert.deepEqual(rows, [{ provider: 'deepinfra', input: .075, output: .25, latency: .34, throughput: 161 }]);
  const endpoint = { provider_name: 'DeepInfra', pricing: { prompt: '.000000075', completion: '.00000025' } };
  assert.equal(performance(endpoint, { performance: rows }).throughput, 161);
  assert.equal(performance(endpoint, { performance: [...rows, ...rows] }).throughput, null);
  endpoint.pricing.completion = '.000001';
  assert.equal(performance(endpoint, { performance: rows }).throughput, null);
  assert.deepEqual(parsePerformance('<html>Page changed</html>'), []);
});
test('Nitro compares price and throughput without promising latency or intelligence gains', () => {
  const base = { cost: 1, throughput: 30, provider: 'Budget' };
  const fast = { cost: 2, throughput: 160, provider: 'Fast' };
  assert.match(nitroAdvice([base, fast], base).text, /Worth considering/);
  assert.match(nitroAdvice([base, { ...fast, cost: 10 }], base).text, /Only if speed/);
  assert.match(nitroAdvice([base], base).text, /Unknown/);
  assert.match(nitroAdvice([base, { ...fast, throughput: 31 }], base).text, /Not worthwhile/);
});
