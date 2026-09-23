import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleCatalog, developerPicks, parsePerformance, performance, nitroAdvice } from '../developer-picks.js';
import { DEFAULT_SETTINGS, FRESH_MS } from '../pricing.js';
const now = new Date('2026-09-08T12:00:00Z');
const model = id => ({ id, name: id, pricing: { prompt: '.000001', completion: '.000002' } });
test('eligibility keeps allowed makers within the weekly top 200', () => {
  const catalog = Array.from({ length: 201 }, (_, i) => model(`openai/model-${i}`));
  catalog[3].id = '~openai/alias';
  const result = eligibleCatalog(catalog);
  assert.equal(result.length, 199);
  assert.equal(result[0].id, 'openai/model-0');
  assert.equal(result.at(-1).id, 'openai/model-199');
  assert.equal(result.some(row => row.id === 'openai/model-200'), false);
  assert.equal(result.find(row => row.id === 'openai/model-4').popularityRank, 5);
});
function fixture(withBenchmarks = true) {
  const ids = ['openai/code-star', 'anthropic/architect', 'google/agent', 'z-ai/value', 'xiaomi/critical'];
  const models = eligibleCatalog(ids.map((id, index) => ({
    ...model(id), context_length: (index + 1) * 100000,
  })));
  const prices = { 'openai/code-star': .000002, 'anthropic/architect': .000003,
    'google/agent': .0000025, 'z-ai/value': .0000001, 'xiaomi/critical': .00002 };
  const details = Object.fromEntries(models.map((m, index) => [m.id, { at: +now, endpoints: [{
    status: 0, provider_name: 'Test', latency_last_30m: { p50: 1 - index * .2 },
    throughput_last_30m: { p50: index === 4 ? 300 : 50 + index * 50 },
    pricing: { prompt: String(prices[m.id]), completion: String(prices[m.id]) },
  }] }]));
  const benchmarks = withBenchmarks ? { asOf: '2026-09-15T00:00:00Z', fetchedAt: +now, byModel: {
    'openai/code-star': { coding: 98, intelligence: 72, agentic: 82 },
    'anthropic/architect': { coding: 75, intelligence: 98, agentic: 91 },
    'google/agent': { coding: 86, intelligence: 84, agentic: 99 },
    'z-ai/value': { coding: 84, intelligence: 80, agentic: 82 },
    'xiaomi/critical': { coding: 86, intelligence: 94, agentic: 93 },
  } } : null;
  return { schema: 5, models, details, benchmarks };
}
test('custom preferences rank five matches without provider rules or fixed purposes', () => {
  const result = developerPicks(fixture(), {
    ...DEFAULT_SETTINGS, priorities: { cheaper: true, smarter: false, faster: false },
  }, now);
  assert.equal(result.picks.length, 5);
  assert.equal(result.picks[0].id, 'z-ai/value');
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
  assert.equal(smart.picks[0].id, 'xiaomi/critical');
  assert.equal(fast.picks[0].id, 'xiaomi/critical');
  assert.equal(developerPicks(fixture(false), {
    ...DEFAULT_SETTINGS, priorities: { smarter: true },
  }, now).picks.length, 0);
});
test('Developer Picks uses Artificial Analysis intelligence, speed and task cost', () => {
  const state = fixture();
  state.artificialAnalysis = { asOf: '2026-09-23T00:00:00Z', byModel: Object.fromEntries(
    state.models.map((model, index) => [model.id, {
      intelligence: index === 1 ? 99 : 40,
      speed: index === 2 ? 400 : 20,
      costPerTask: index === 3 ? .01 : 5,
    }]),
  ) };
  assert.equal(developerPicks(state, { ...DEFAULT_SETTINGS, priorities: { smarter: true } }, now).picks[0].id,
    'anthropic/architect');
  assert.equal(developerPicks(state, { ...DEFAULT_SETTINGS, priorities: { faster: true } }, now).picks[0].id,
    'google/agent');
  const cheap = developerPicks(state, { ...DEFAULT_SETTINGS, priorities: { cheaper: true } }, now);
  assert.equal(cheap.picks[0].id, 'z-ai/value');
  assert.equal(cheap.evidenceSource, 'artificial-analysis');
});
test('every individual and combined choice returns matches from public catalog evidence', () => {
  const state = fixture(false);
  state.models.forEach((model, index) => {
    model.benchmarks = { artificial_analysis: { intelligence_index: 50 + index * 8 } };
    delete state.details[model.id].endpoints[0].latency_last_30m;
    delete state.details[model.id].endpoints[0].throughput_last_30m;
  });
  state.speedRanks = { byModel: Object.fromEntries(state.models.map((model, index) =>
    [model.id, (index + 1) / state.models.length])) };
  for (const priorities of [{ cheaper: true }, { smarter: true }, { faster: true },
    { cheaper: true, smarter: true }, { cheaper: true, faster: true },
    { smarter: true, faster: true }, { cheaper: true, smarter: true, faster: true }]) {
    const result = developerPicks(state, { ...DEFAULT_SETTINGS, priorities }, now);
    assert.equal(result.picks.length, 5);
    assert.deepEqual(result.unavailablePreferences, []);
  }
  assert.equal(developerPicks(state, { ...DEFAULT_SETTINGS, priorities: { smarter: true } }, now).picks[0].id,
    'xiaomi/critical');
  assert.equal(developerPicks(state, { ...DEFAULT_SETTINGS, priorities: { faster: true } }, now).picks[0].id,
    'xiaomi/critical');
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
  assert.equal(developerPicks(state, DEFAULT_SETTINGS, now).picks[0].id, 'z-ai/value');
  state.details['z-ai/value'].endpoints[0].pricing = { prompt: '1', completion: '1' };
  assert.notEqual(developerPicks(state, DEFAULT_SETTINGS, now).picks[0].id, 'z-ai/value');
  assert.equal(developerPicks(state, DEFAULT_SETTINGS, new Date(+now + FRESH_MS)).picks.length, 0);
  state.details['openai/code-star'].endpoints[0].status = -2;
  assert.equal(developerPicks(state, DEFAULT_SETTINGS, now).picks.some(r => r.id === 'openai/code-star'), false);
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
