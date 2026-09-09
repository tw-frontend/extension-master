import assert from "node:assert/strict";
import test from "node:test";

import {
  createCommandHandler,
  createMessageListener,
} from "../background.js";
import { createKeyStore } from "../src/gate/key-store.js";

function fakeStorage() {
  const values = {};
  return {
    async get(key) {
      return { [key]: values[key] };
    },
    async set(update) {
      Object.assign(values, structuredClone(update));
    },
    async remove(key) {
      delete values[key];
    },
  };
}

test("configure, status, and clear complete the secret lifecycle", async () => {
  const handle = createCommandHandler(createKeyStore(fakeStorage()));

  assert.deepEqual(await handle({ type: "gate/status" }), {
    ok: true,
    data: { isConfigured: false },
  });
  assert.deepEqual(
    await handle({ type: "gate/configure", apiKey: " test-key " }),
    { ok: true, data: { isConfigured: true } },
  );
  assert.deepEqual(await handle({ type: "gate/status" }), {
    ok: true,
    data: { isConfigured: true },
  });
  assert.deepEqual(await handle({ type: "gate/clear" }), {
    ok: true,
    data: { isConfigured: false },
  });
});

test("malformed and unknown commands fail without changing storage", async () => {
  const handle = createCommandHandler(createKeyStore(fakeStorage()));
  await handle({ type: "gate/configure", apiKey: "test-key" });

  for (const command of [null, {}, { type: "gate/unknown" }]) {
    const result = await handle(command);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "UPSTREAM_ERROR");
  }
  assert.deepEqual(await handle({ type: "gate/status" }), {
    ok: true,
    data: { isConfigured: true },
  });
});

test("message listener responds exactly once and keeps the channel open", async () => {
  let responseCount = 0;
  let resolveResponse;
  const response = new Promise((resolve) => {
    resolveResponse = resolve;
  });
  const listener = createMessageListener(async () => ({
    ok: true,
    data: { isConfigured: false },
  }));

  const staysOpen = listener({ type: "gate/status" }, {}, (result) => {
    responseCount += 1;
    resolveResponse(result);
  });

  assert.equal(staysOpen, true);
  assert.deepEqual(await response, {
    ok: true,
    data: { isConfigured: false },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(responseCount, 1);
});

test("unexpected command failures return a generic redacted result", async () => {
  const secret = "private-test-key";
  const listener = createMessageListener(async () => {
    throw new Error(`unexpected failure for ${secret}`);
  });

  const result = await new Promise((resolve) => {
    listener({ type: "gate/status" }, {}, resolve);
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "UPSTREAM_ERROR");
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
});

test("load returns a validated budget without exposing the configured key", async () => {
  let loadedKey;
  const keyStore = createKeyStore(fakeStorage());
  const handle = createCommandHandler(keyStore, {
    async getBudget(apiKey) {
      loadedKey = apiKey;
      return {
        ok: true,
        data: { remainingBudget: 7.5 },
        receivedAt: "2026-09-09T10:00:00.000Z",
      };
    },
    async getSpend(apiKey, range) {
      assert.equal(apiKey, "private-test-key");
      assert.deepEqual(range, {
        startDate: "2026-09-02",
        endDate: "2026-09-09",
      });
      return {
        ok: true,
        data: {
          totalSpend: 2,
          averageDailySpend: 1,
          spendOverTime: [],
          spendByModel: [],
        },
        receivedAt: "2026-09-09T10:00:00.000Z",
      };
    },
  });
  await handle({ type: "gate/configure", apiKey: "private-test-key" });

  const result = await handle({
    type: "gate/load",
    range: { startDate: "2026-09-02", endDate: "2026-09-09" },
  });

  assert.equal(loadedKey, "private-test-key");
  assert.deepEqual(result, {
    ok: true,
    data: {
      budget: {
        ok: true,
        data: { remainingBudget: 7.5 },
        receivedAt: "2026-09-09T10:00:00.000Z",
      },
      spend: {
        ok: true,
        data: {
          totalSpend: 2,
          averageDailySpend: 1,
          spendOverTime: [],
          spendByModel: [],
        },
        receivedAt: "2026-09-09T10:00:00.000Z",
      },
    },
  });
  assert.doesNotMatch(JSON.stringify(result), /private-test-key/);
});

test("load without configuration or with invalid dates makes no client calls", async () => {
  let calls = 0;
  const keyStore = createKeyStore(fakeStorage());
  const handle = createCommandHandler(keyStore, {
    async getBudget() {
      calls += 1;
      return { ok: true, data: { remainingBudget: 1 } };
    },
    async getSpend() {
      calls += 1;
      return { ok: true, data: { totalSpend: 1 } };
    },
  });

  assert.equal(
    (
      await handle({
        type: "gate/load",
        range: { startDate: "2026-09-02", endDate: "2026-09-09" },
      })
    ).error.code,
    "NOT_CONFIGURED",
  );
  await handle({ type: "gate/configure", apiKey: "test-key" });
  assert.equal(
    (
      await handle({
        type: "gate/load",
        range: { startDate: "2026-09-10", endDate: "2026-09-09" },
      })
    ).error.code,
    "INVALID_DATE_RANGE",
  );
  assert.equal(calls, 0);
});
