import test from 'node:test';
import assert from 'node:assert/strict';
let db = {}, calls = [];
const event = { addListener() {} };
globalThis.chrome = { storage: { local: { async get() { return structuredClone(db); }, async set(value) { Object.assign(db, structuredClone(value)); } } },
  alarms: { async get() { return {}; }, async create() {}, onAlarm: event },
  action: { async setBadgeText() {} }, runtime: { onInstalled: event, onStartup: event, onMessage: event } };
const { scan } = await import('../background.js');
const model = id => ({ id, name: id, pricing: { prompt: '0', completion: '0' } });
test('scan checkpoints batches and resumes, including models outside preferences', async () => {
  db = {}; calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    return { ok: true, async json() { return { data: url.includes('/models?')
      ? [...Array.from({ length: 20 }, (_, i) => model(`openai/model-${i}`)), model('z-ai/glm')]
      : { endpoints: [] } }; } };
  };
  await scan();
  assert.equal(db.state.queue.length, 3);
  assert.ok(calls.some(url => /openai\/model-0\/endpoints$/.test(url)));
  assert.ok(db.state.speedRanks.byModel['openai/model-0'] != null);
  await scan();
  assert.equal(db.state.queue.length, 0);
  assert.equal(Object.keys(db.state.details).length, 21);
  assert.equal(calls.filter(url => url.includes('sort=top-weekly')).length, 1);
  assert.equal(calls.filter(url => url.includes('sort=latency-low-to-high')).length, 1);
  assert.equal(calls.filter(url => url.includes('sort=throughput-high-to-low')).length, 1);
});
test('429 backs off without losing pending work; failed catalog preserves cache', async () => {
  db = { state: { models: [model('a/b')], catalogAt: Date.now(), details: {}, queue: ['a/b'] } };
  calls = [];
  globalThis.fetch = async url => { calls.push(url); return { ok: false, status: 429, headers: new Headers({ 'Retry-After': '120' }) }; };
  await scan();
  assert.deepEqual(db.state.queue, ['a/b']); assert.ok(db.state.retryAt > Date.now() + 110000);
  await scan(); assert.equal(calls.length, 1);
  db.state.retryAt = 0;
  globalThis.fetch = async () => { throw new Error('offline'); };
  await scan(true);
  assert.equal(db.state.models[0].id, 'a/b'); assert.equal(db.state.error, 'offline');
});
test('upgrade refreshes old caches and keeps only recent allowed top-200 models', async () => {
  db = { state: { models: [], catalogAt: Date.now(), details: {}, queue: [] } };
  const catalog = [model('z-ai/glm-4'), model('z-ai/glm-5.2'), model('z-ai/glm-5.3'),
    ...Array.from({ length: 197 }, (_, i) => model(`other/${i}`)), model('z-ai/glm-5.4')];
  globalThis.fetch = async url => ({ ok: true, async json() {
    if (url.includes('/models?')) { assert.match(url, /sort=top-weekly/); return { data: catalog }; }
    return { data: { endpoints: [] } };
  } });
  await scan();
  assert.equal(db.state.schema, 4); assert.equal(db.state.models.length, 2);
  assert.equal(db.state.models.find(m => m.id === 'z-ai/glm-5.3').popularityRank, 3);
  assert.equal(db.state.models.find(m => m.id === 'z-ai/glm-5.2').popularityRank, 2);
  assert.equal(db.state.models.some(m => m.id === 'z-ai/glm-4'), false);
  assert.equal(db.state.models.some(m => m.id === 'z-ai/glm-5.4'), false);
});
test('scan checks free routes first so the Free view fills early', async () => {
  db = {};
  globalThis.fetch = async url => ({ ok: true, async json() { return { data: url.includes('/models?')
    ? [...Array.from({ length: 20 }, (_, index) => model(`openai/model-${index}`)), model('qwen/qwen3.8-27b:free')]
    : { endpoints: [] } }; } });
  await scan();
  assert.ok(db.state.details['qwen/qwen3.8-27b:free']);
  assert.equal(db.state.queue.length, 3);
});
test('selecting faster backfills missing provider performance once per refresh window', async () => {
  const row = model('z-ai/glm');
  db = { settings: { priorities: { faster: true } }, state: { schema: 4, models: [{ ...row, popularityRank: 1 }],
    catalogAt: Date.now(), queue: [], details: { 'z-ai/glm': { at: Date.now(), endpoints: [{
      status: 0, provider_name: 'Demo', pricing: { prompt: '.000001', completion: '.000002' },
    }] } } } };
  calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    if (url.endsWith('/z-ai/glm')) return { ok: true, async text() { return '<html>No provider table</html>'; } };
    return { ok: true, async json() { return { data: { endpoints: [{ status: 0, provider_name: 'Demo',
      pricing: { prompt: '.000001', completion: '.000002' } }] } }; } };
  };
  await scan();
  assert.equal(calls.some(url => url.endsWith('/z-ai/glm')), true);
  assert.ok(db.state.details['z-ai/glm'].performanceCheckedAt);
  calls = [];
  await scan();
  assert.equal(calls.length, 0);
});
test('a configured key fetches benchmarks with auth but never copies the key into state', async () => {
  const apiKey = 'sk-or-v1-test-secret';
  db = { credentials: { apiKey } }; calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('/benchmarks')) {
      assert.equal(options.headers.Authorization, `Bearer ${apiKey}`);
      return { ok: true, async json() { return { data: [{ source: 'artificial-analysis',
        model_permaslug: 'novel/model', coding_index: 90, intelligence_index: 80, agentic_index: 85 }],
        meta: { as_of: '2026-09-15T00:00:00Z' } }; } };
    }
    return { ok: true, async json() { return { data: url.includes('/models?') ? [model('novel/model')] :
      { endpoints: [{ status: 0, pricing: { prompt: '.000001', completion: '.000002' } }] } }; } };
  };
  await scan();
  assert.equal(db.state.queue.length, 0);
  assert.equal(db.state.benchmarks.byModel['novel/model'].coding, 90);
  assert.equal(JSON.stringify(db.state).includes(apiKey), false);
});
test('benchmark authentication failure falls back without blocking price scanning', async () => {
  db = { credentials: { apiKey: 'invalid-key' } };
  globalThis.fetch = async url => {
    if (url.includes('/benchmarks')) return { ok: false, status: 401, headers: new Headers() };
    return { ok: true, async json() { return { data: url.includes('/models?') ? [model('novel/model')] :
      { endpoints: [{ status: 0, pricing: { prompt: '.000001', completion: '.000002' } }] } }; } };
  };
  await scan();
  assert.equal(db.state.queue.length, 0);
  assert.equal(db.state.benchmarks, undefined);
  assert.match(db.state.benchmarkError, /could not be loaded/i);
  assert.equal(JSON.stringify(db.state).includes('invalid-key'), false);
});
test('tampered credential storage fails validation before any authenticated request', async () => {
  db = { credentials: { apiKey: 'bad' } }; calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    return { ok: true, async json() { return { data: url.includes('/models?') ? [model('novel/model')] :
      { endpoints: [] } }; } };
  };
  await scan();
  assert.equal(calls.some(url => url.includes('/benchmarks')), false);
  assert.equal(db.state.queue.length, 0);
  assert.match(db.state.benchmarkError, /not valid/i);
});
