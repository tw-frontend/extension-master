import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibleCatalog, isEligibleModel } from '../model-eligibility.js';

const model = id => ({ id, name: id, pricing: { prompt: '0.000001', completion: '0.000002' } });

test('limits the weekly top 200 to the seven requested makers', () => {
  const catalog = [model('openai/gpt-6-astra'), model('anthropic/claude-opus-5'),
    model('z-ai/glm-5.3'), model('xiaomi/mimo-v2.6-pro'), model('qwen/qwen3.8-flash'),
    model('google/gemini-3.8-flash'), model('deepseek/deepseek-v4.1-flash'),
    model('random/model-99'), model('openrouter/auto')];
  assert.equal(eligibleCatalog(catalog).length, 7);
  assert.equal(isEligibleModel(model('random/model-99')), false);
  assert.equal(eligibleCatalog([...Array.from({ length: 200 }, () => model('random/model')),
    model('openai/gpt-6-astra')]).length, 0);
});

test('keeps Opus 5 and 4.8 while dropping 4.7 and 4.6', () => {
  const models = ['anthropic/claude-opus-4.6', 'anthropic/claude-opus-4.7:free',
    'anthropic/claude-opus-4.8', 'anthropic/claude-opus-5'].map(model);
  assert.deepEqual(eligibleCatalog(models).map(row => row.id),
    ['anthropic/claude-opus-4.8', 'anthropic/claude-opus-5']);
});

test('compares versions within a family and retains free variants of current versions', () => {
  const models = ['qwen/qwen3.5-flash', 'qwen/qwen3.6-flash', 'qwen/qwen3.7-flash',
    'qwen/qwen3.8-flash', 'qwen/qwen3.8-27b:free', 'google/gemini-3.1-pro-preview',
    'anthropic/claude-sonnet-4.6'].map(model);
  assert.deepEqual(eligibleCatalog(models).map(row => row.id),
    ['qwen/qwen3.7-flash', 'qwen/qwen3.8-flash', 'qwen/qwen3.8-27b:free',
      'google/gemini-3.1-pro-preview', 'anthropic/claude-sonnet-4.6']);
});

test('older legacy Qwen naming is compared with current Qwen versions', () => {
  const models = ['qwen/qwen-2.5-7b-instruct', 'qwen/qwen3.6-27b',
    'qwen/qwen3.8-27b:free'].map(model);
  assert.deepEqual(eligibleCatalog(models).map(row => row.id),
    ['qwen/qwen3.6-27b', 'qwen/qwen3.8-27b:free']);
});
