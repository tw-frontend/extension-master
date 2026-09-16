import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRIORITIES,
  normalizePriorities,
  rankByPreferences,
} from '../preferences.js';

const rows = [
  { id: 'cheap/model', cost: 1, quality: 20, latency: 2, throughput: 40, popularityRank: 2 },
  { id: 'smart/model', cost: 5, quality: 100, latency: 1, throughput: 100, popularityRank: 3 },
  { id: 'balanced/model', cost: 2, quality: 70, latency: .8, throughput: 120, popularityRank: 4 },
  { id: 'fast/model', cost: 4, quality: 50, latency: .2, throughput: 300, popularityRank: 1 },
];

test('priorities default to cheaper and reject an empty or tampered selection', () => {
  assert.deepEqual(normalizePriorities(), DEFAULT_PRIORITIES);
  assert.deepEqual(normalizePriorities({ cheaper: false, smarter: false, faster: false }), DEFAULT_PRIORITIES);
  assert.deepEqual(normalizePriorities({ cheaper: 1, smarter: true, faster: 'yes' }), {
    cheaper: false, smarter: true, faster: false,
  });
});

test('each individual preference selects the matching evidence leader', () => {
  assert.equal(rankByPreferences(rows, { cheaper: true })[0].id, 'cheap/model');
  assert.equal(rankByPreferences(rows, { smarter: true })[0].id, 'smart/model');
  assert.equal(rankByPreferences(rows, { faster: true })[0].id, 'fast/model');
});

test('selected preferences are combined with equal normalized weight', () => {
  const ranked = rankByPreferences(rows, { cheaper: true, smarter: true });
  assert.equal(ranked[0].id, 'balanced/model');
  assert.deepEqual(ranked[0].matchedPreferences, ['cheaper', 'smarter']);
  assert.ok(ranked[0].preferenceScore > ranked[1].preferenceScore);
});

test('models missing evidence for any selected preference are excluded', () => {
  const candidates = [
    { id: 'complete', cost: 2, quality: 70, latency: .5, throughput: null, popularityRank: 2 },
    { id: 'missing-quality', cost: 1, quality: null, latency: .1, throughput: 500, popularityRank: 1 },
  ];
  assert.deepEqual(
    rankByPreferences(candidates, { cheaper: true, smarter: true, faster: true }).map(row => row.id),
    ['complete'],
  );
  assert.deepEqual(rankByPreferences(candidates, { smarter: true }).map(row => row.id), ['complete']);
});
