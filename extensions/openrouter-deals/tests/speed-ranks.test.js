import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpeedRanks, speedFor } from '../speed-ranks.js';

test('public speed sort ranks only eligible top-200 models and keeps missing data missing', () => {
  const models = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const ranks = normalizeSpeedRanks(models,
    [{ id: 'outside' }, { id: 'c' }, { id: 'a' }, { id: 'b' }],
    [{ id: 'b' }, { id: 'a' }, { id: 'c' }]);
  assert.ok(speedFor(models[1], ranks) > speedFor(models[0], ranks));
  assert.ok(speedFor(models[0], ranks) > speedFor(models[2], ranks));
  assert.equal(speedFor({ id: 'missing' }, ranks), null);
});
