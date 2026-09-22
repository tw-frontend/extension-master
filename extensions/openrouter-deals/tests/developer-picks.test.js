import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleCatalog, developerPicks, parsePerformance, performance, nitroAdvice } from '../developer-picks.js';
import { DEFAULT_SETTINGS, FRESH_MS } from '../pricing.js';
const now = new Date('2026-09-08T12:00:00Z');
const model = id => ({ id, name: id, pricing: { prompt: '.000001', completion: '.000002' } });
test('eligibility accepts every valid provider in the first 200 without a family allowlist', () => {
  const catalog = Array.from({ length: 201 }, (_, i) => model(`provider-${i}/model`));
  catalog[3].id = '~provider/alias';
  const result = eligibleCatalog(catalog);
  assert.equal(result.length, 199);
  assert.equal(result[0].id, 'provider-0/model');
  assert.equal(result.at(-1).id, 'provider-199/model');
  assert.equal(result.some(row => row.id === 'provider-200/model'), false);
  assert.equal(result.find(row => row.id === 'provider-4/model').popularityRank, 5);
});
function fixture(withBenchmarks = true) {
  const ids = ['alpha/code-star', 'beta/architect', 'gamma/agent', 'delta/value', 'omega/critical'];
  const models = eligibleCatalog(ids.map((id, index) => ({
    ...model(id), context_length: (index + 1) * 100000,
  })));
  const prices = { 'alpha/code-star': .000002, 'beta/architect': .000003,
    'gamma/agent': .0000025, 'delta/value': .0000001, 'omega/critical': .00002 };
  const details = Object.fromEntries(models.map((m, index) => [m.id, { at: +now, endpoints: [{
    status: 0, provider_name: 'Test', latency_last_30m: { p50: 1 - index * .2 },
    throughput_last_30m: { p50: index === 4 ? 300 : 50 + index * 50 },
    pricing: { prompt: String(prices[m.id]), completion: String(prices[m.id]) },
  }] }]));
  const benchmarks = withBenchmarks ? { asOf: '2026-09-15T00:00:00Z', fetchedAt: +now, byModel: {
    'alpha/code-star': { coding: 98, intelligence: 72, agentic: 82 },
    'beta/architect': { coding: 75, intelligence: 98, agentic: 91 },
    'gamma/agent': { coding: 86, intelligence: 84, agentic: 99 },
    'delta/value': { coding: 84, intelligence: 80, agentic: 82 },
    'omega/critical': { coding: 86, intelligence: 94, agentic: 93 },
  } } : null;
  return { schema: 3, models, details, benchmarks };
}
test('custom preferences rank five matches without provider rules or fixed purposes', () => {
  const result = developerPicks(fixture(), {
    ...DEFAULT_SETTINGS, priorities: { cheaper: true, smarter: false, faster: false },
  }, now);
  assert.equal(result.picks.length, 5);
  assert.equal(result.picks[0].id, 'delta/value');
  assert.deepEqual(result.priorities, { cheaper: true, smarter: false, faster: false });
  assert.deepEqual(result.picks[0].matchedPreferences, ['cheaper']);
  assert.equal(result.benchmarked, 5);
  assert.equal(result.benchmarkAsOf, '2026-09-15T00:00:00Z');
});
test('smarter and faster preferences use their own evidence', () => {
  const smart = developerPicks(fixture(), {
    ...DEFAULT_SETTINGS, priorities: { smarter: true },
  }, now);
  const fast = developerPicks(fixture(), {
    ...DEFAULT_SETTINGS, priorities: { faster: true },
  }, now);
  assert.equal(smart.picks[0].id, 'omega/critical');
  assert.equal(fast.picks[0].id, 'omega/critical');
  assert.equal(developerPicks(fixture(false), {
    ...DEFAULT_SETTINGS, priorities: { smarter: true },
  }, now).picks.length, 0);
});
test('combined choices show provisional matches when all benchmark evidence is absent', () => {
  const result = developerPicks(fixture(false), {
    ...DEFAULT_SETTINGS, priorities: { cheaper: true, smarter: true, faster: true },
  }, now);
  assert.equal(result.picks.length, 5);
  assert.deepEqual(result.unavailablePreferences, ['smarter']);
  assert.deepEqual(result.picks[0].matchedPreferences, ['cheaper', 'faster']);
  assert.equal(result.picks[0].preferenceBreakdown.smarter, undefined);
});
test('all three choices retain provisional price matches when speed and quality are absent', () => {
  const state = fixture(false);
  for (const detail of Object.values(state.details)) {
    delete detail.endpoints[0].latency_last_30m;
    delete detail.endpoints[0].throughput_last_30m;
  }
  const result = developerPicks(state, { ...DEFAULT_SETTINGS,
    priorities: { cheaper: true, smarter: true, faster: true } }, now);
  assert.equal(result.picks.length, 5);
  assert.deepEqual(result.unavailablePreferences, ['smarter', 'faster']);
  assert.deepEqual(result.picks[0].matchedPreferences, ['cheaper']);
});
test('faster preference skips models whose providers have no speed evidence', () => {
  const state = fixture();
  for (const detail of Object.values(state.details)) {
    delete detail.endpoints[0].latency_last_30m;
    delete detail.endpoints[0].throughput_last_30m;
  }
  assert.doesNotThrow(() => developerPicks(state, {
    ...DEFAULT_SETTINGS, priorities: { faster: true },
  }, now));
  assert.equal(developerPicks(state, {
    ...DEFAULT_SETTINGS, priorities: { faster: true },
  }, now).picks.length, 0);
});
test('live price changes alter cheaper selection; stale or unavailable quotes cannot be picks', () => {
  const state = fixture();
  assert.equal(developerPicks(state, DEFAULT_SETTINGS, now).picks[0].id, 'delta/value');
  state.details['delta/value'].endpoints[0].pricing = { prompt: '1', completion: '1' };
  assert.notEqual(developerPicks(state, DEFAULT_SETTINGS, now).picks[0].id, 'delta/value');
  assert.equal(developerPicks(state, DEFAULT_SETTINGS, new Date(+now + FRESH_MS)).picks.length, 0);
  state.details['alpha/code-star'].endpoints[0].status = -2;
  assert.equal(developerPicks(state, DEFAULT_SETTINGS, now).picks.some(r => r.id === 'alpha/code-star'), false);
  state.schema = 2; assert.equal(developerPicks(state, DEFAULT_SETTINGS, now).picks.length, 0);
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
