import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiKey } from '../credentials.js';

test('API keys are trimmed and bounded without assuming a vendor key format', () => {
  assert.equal(normalizeApiKey('  dedicated-test-key  '), 'dedicated-test-key');
  assert.throws(() => normalizeApiKey('short'), /between 8 and 512/i);
  assert.throws(() => normalizeApiKey(`key-${'a'.repeat(509)}`), /between 8 and 512/i);
  assert.throws(() => normalizeApiKey('invalid key with spaces'), /whitespace/i);
});
