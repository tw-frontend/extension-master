import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analysisFor,
  artificialAnalysisFresh,
  normalizeArtificialAnalysis,
} from '../artificial-analysis.js';

const payload = {
  schema: 1,
  source: 'Artificial Analysis',
  sourceUrl: 'https://artificialanalysis.ai/',
  attribution: 'Data source: Artificial Analysis',
  generatedAt: '2026-09-23T00:00:00.000Z',
  intelligenceIndexVersion: 4.3,
  models: {
    'openai/gpt-6-astra': {
      name: 'GPT-6 Astra (max)',
      intelligence: 53,
      speed: 58,
      costPerTask: 3.26,
    },
    'broken/model': { intelligence: 'high', speed: -1, costPerTask: null },
  },
};

test('licensed Artificial Analysis snapshots are minimized and validated', () => {
  const result = normalizeArtificialAnalysis(payload, new Date('2026-09-23T01:00:00Z'));
  assert.deepEqual(result.byModel['openai/gpt-6-astra'], {
    name: 'GPT-6 Astra (max)', intelligence: 53, speed: 58, costPerTask: 3.26,
  });
  assert.equal(result.byModel['broken/model'], undefined);
  assert.equal(result.asOf, payload.generatedAt);
  assert.equal(result.intelligenceIndexVersion, 4.3);
  assert.equal(result.fetchedAt, Date.parse('2026-09-23T01:00:00Z'));
});

test('Artificial Analysis matching is exact by OpenRouter id or canonical slug', () => {
  const snapshot = normalizeArtificialAnalysis(payload);
  assert.equal(analysisFor({ id: 'openai/gpt-6-astra' }, snapshot).speed, 58);
  assert.equal(analysisFor({ id: 'alias/astra', canonical_slug: 'openai/gpt-6-astra' }, snapshot).costPerTask, 3.26);
  assert.equal(analysisFor({ id: 'openai/gpt-6-astra-preview' }, snapshot), null);
});

test('snapshots expire instead of silently ranking stale metrics', () => {
  const snapshot = normalizeArtificialAnalysis(payload, new Date('2026-09-23T01:00:00Z'));
  assert.equal(artificialAnalysisFresh(snapshot, new Date('2026-09-25T23:59:59Z')), true);
  assert.equal(artificialAnalysisFresh(snapshot, new Date('2026-09-26T00:00:00Z')), false);
});

test('unexpected snapshot envelopes fail closed', () => {
  assert.throws(() => normalizeArtificialAnalysis(null), /snapshot/i);
  assert.throws(() => normalizeArtificialAnalysis({ ...payload, schema: 2 }), /snapshot/i);
  assert.throws(() => normalizeArtificialAnalysis({ ...payload, source: 'Copied chart' }), /snapshot/i);
});
