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
