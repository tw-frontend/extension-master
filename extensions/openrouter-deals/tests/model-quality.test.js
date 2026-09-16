import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBenchmarks,
  benchmarkFor,
  scorePurpose,
  overallScore,
} from '../model-quality.js';

const payload = {
  data: [
    {
      source: 'artificial-analysis',
      model_permaslug: 'new-provider/code-star',
      coding_index: 92,
      intelligence_index: 80,
      agentic_index: 88,
    },
    {
      source: 'artificial-analysis',
      model_permaslug: 'partial/model',
      coding_index: 71,
      intelligence_index: null,
      agentic_index: null,
    },
    { source: 'unknown', model_permaslug: 'ignored/model', coding_index: 100 },
    { source: 'artificial-analysis', model_permaslug: '', coding_index: 100 },
  ],
  meta: {
    as_of: '2026-09-15T00:00:00Z',
    citation: 'Source: Artificial Analysis via OpenRouter.',
  },
};

test('benchmark payloads are minimized and malformed records are ignored', () => {
  const result = normalizeBenchmarks(payload, new Date('2026-09-16T00:00:00Z'));
  assert.deepEqual(result.byModel['new-provider/code-star'], {
    coding: 92,
    intelligence: 80,
    agentic: 88,
  });
  assert.deepEqual(result.byModel['partial/model'], { coding: 71 });
  assert.equal(result.byModel['ignored/model'], undefined);
  assert.equal(result.asOf, payload.meta.as_of);
  assert.equal(result.fetchedAt, Date.parse('2026-09-16T00:00:00Z'));
  assert.equal(JSON.stringify(result).includes('pricing'), false);
});

test('benchmarks use exact id or canonical slug and never fuzzy provider matching', () => {
  const benchmarks = normalizeBenchmarks(payload);
  assert.equal(benchmarkFor({ id: 'new-provider/code-star' }, benchmarks).coding, 92);
  assert.equal(benchmarkFor({ id: 'alias/code-star', canonical_slug: 'new-provider/code-star' }, benchmarks).agentic, 88);
  assert.equal(benchmarkFor({ id: 'new-provider/code-star-plus' }, benchmarks), null);
});

test('purpose scores require the purpose-specific primary benchmark', () => {
  const complete = { coding: 92, intelligence: 80, agentic: 88 };
  assert.equal(scorePurpose(complete, 'coding'), 89.2);
  assert.equal(scorePurpose(complete, 'planning'), 84);
  assert.equal(scorePurpose(complete, 'agentic'), 87.8);
  assert.equal(scorePurpose({ intelligence: 90 }, 'coding'), null);
  assert.equal(scorePurpose({ coding: 71 }, 'coding'), 71);
  assert.equal(overallScore(complete), 86.7);
});

test('invalid benchmark envelopes fail closed', () => {
  assert.throws(() => normalizeBenchmarks(null), /benchmark response/i);
  assert.throws(() => normalizeBenchmarks({ data: 'nope' }), /benchmark response/i);
});
