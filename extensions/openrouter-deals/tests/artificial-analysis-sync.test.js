import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, fetchPages } from '../../../scripts/sync-artificial-analysis.mjs';

test('sync keeps exact OpenRouter ids and the three ranking metrics', () => {
  const result = buildSnapshot([{ tier: 'commercial', intelligence_index_version: 4.3, data: [
    {
      name: 'GPT-6 Astra (max)', slug: 'gpt-6-astra-max', openrouter_api_id: 'openai/gpt-6-astra',
      model_creator: { name: 'OpenAI', slug: 'openai' },
      evaluations: { artificial_analysis_intelligence_index: 53 },
      artificial_analysis_intelligence_index_cost: { cost_per_task: { total_cost: 3.26 } },
      performance: { median_output_tokens_per_second: 58 },
    },
    {
      name: 'Unmapped', slug: 'unmapped', openrouter_api_id: null,
      model_creator: { name: 'OpenAI', slug: 'openai' },
      evaluations: { artificial_analysis_intelligence_index: 99 },
      artificial_analysis_intelligence_index_cost: { cost_per_task: { total_cost: 0.01 } },
      performance: { median_output_tokens_per_second: 999 },
    },
    {
      name: 'Excluded maker', slug: 'excluded', openrouter_api_id: 'other/model',
      model_creator: { name: 'Other', slug: 'other' },
      evaluations: { artificial_analysis_intelligence_index: 99 },
      artificial_analysis_intelligence_index_cost: { cost_per_task: { total_cost: 0.01 } },
      performance: { median_output_tokens_per_second: 999 },
    },
  ] }], new Date('2026-09-23T00:00:00Z'));
  assert.deepEqual(Object.keys(result.models), ['openai/gpt-6-astra']);
  assert.deepEqual(result.models['openai/gpt-6-astra'], {
    name: 'GPT-6 Astra (max)', creator: 'OpenAI', artificialAnalysisSlug: 'gpt-6-astra-max',
    intelligence: 53, speed: 58, costPerTask: 3.26,
  });
  assert.equal(result.intelligenceIndexVersion, 4.3);
});

test('sync rejects non-commercial API responses before redistribution', () => {
  assert.throws(() => buildSnapshot([{ tier: 'free', data: [] }]), /commercial/i);
  assert.throws(() => buildSnapshot([{ tier: 'pro', data: [] }]), /commercial/i);
});

test('sync paginates the documented API and sends the key only in its header', async () => {
  const calls = [];
  const pages = await fetchPages('aa-test-key', async (url, options) => {
    calls.push({ url, options });
    const page = Number(new URL(url).searchParams.get('page'));
    return { ok: true, async json() { return {
      tier: 'commercial', data: [], pagination: { has_more: page === 1 },
    }; } };
  });
  assert.equal(pages.length, 2);
  assert.deepEqual(calls.map(call => call.url.endsWith(`page=${calls.indexOf(call) + 1}`)), [true, true]);
  assert.ok(calls.every(call => call.options.headers['x-api-key'] === 'aa-test-key'));
  assert.ok(calls.every(call => !call.url.includes('aa-test-key')));
});
