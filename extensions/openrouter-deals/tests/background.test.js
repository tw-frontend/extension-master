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
    return { ok: true, async json() { return { data: url.includes('?')
      ? [...Array.from({ length: 20 }, (_, i) => model(`other/model-${i}`)), model('z-ai/glm')]
      : { endpoints: [] } }; } };
  };
  await scan();
  assert.equal(db.state.queue.length, 3);
  assert.match(calls[1], /z-ai\/glm\/endpoints$/);
  await scan();
  assert.equal(db.state.queue.length, 0);
  assert.equal(Object.keys(db.state.details).length, 21);
  assert.equal(calls.filter(url => url.includes('?')).length, 1);
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
test('upgrade refreshes old caches and keeps top-200 ranks before version filtering', async () => {
  db = { state: { models: [], catalogAt: Date.now(), details: {}, queue: [] } };
  const catalog = [model('z-ai/glm-4'), model('z-ai/glm-5.2'), model('z-ai/glm-5.3'),
    ...Array.from({ length: 197 }, (_, i) => model(`other/${i}`)), model('z-ai/glm-5.4')];
  globalThis.fetch = async url => ({ ok: true, async json() {
    if (url.includes('?')) { assert.match(url, /sort=top-weekly/); return { data: catalog }; }
    return { data: { endpoints: [] } };
  } });
  await scan();
  assert.equal(db.state.schema, 2); assert.equal(db.state.models.length, 200);
  assert.equal(db.state.models.find(m => m.id === 'z-ai/glm-5.3').generation, 'One version back');
  assert.equal(db.state.models.find(m => m.id === 'z-ai/glm-5.2').generation, undefined);
  assert.equal(db.state.models.some(m => m.id === 'z-ai/glm-5.4'), false);
});
test('missing speed page preserves successful endpoint pricing', async () => {
  db = {};
  globalThis.fetch = async url => {
    if (!url.includes('/api/')) throw new Error('speed page offline');
    return { ok: true, async json() { return { data: url.includes('?') ? [model('z-ai/glm-5.3')] :
      { endpoints: [{ status: 0, pricing: { prompt: '.000001', completion: '.000002' } }] } }; } };
  };
  await scan();
  assert.equal(db.state.queue.length, 0);
  assert.equal(db.state.details['z-ai/glm-5.3'].endpoints.length, 1);
  assert.equal(db.state.details['z-ai/glm-5.3'].performanceError, 'speed page offline');
});
