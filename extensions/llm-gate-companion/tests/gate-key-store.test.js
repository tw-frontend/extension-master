import assert from "node:assert/strict";
import test from "node:test";

import { createKeyStore } from "../src/gate/key-store.js";

function fakeStorage(initial = {}) {
  const values = structuredClone(initial);

  return {
    values,
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

test("save trims a key and public status never returns it", async () => {
  const storage = fakeStorage();
  const keyStore = createKeyStore(storage);

  assert.deepEqual(await keyStore.save("  test-key-123  "), {
    ok: true,
    data: { isConfigured: true },
  });
  assert.deepEqual(await keyStore.status(), {
    ok: true,
    data: { isConfigured: true },
  });
  assert.deepEqual(storage.values, { gateApiKey: "test-key-123" });
});

test("save rejects non-string and empty keys without changing storage", async () => {
  const storage = fakeStorage({ gateApiKey: "existing-key" });
  const keyStore = createKeyStore(storage);

  for (const apiKey of [undefined, null, 42, "   "]) {
    const result = await keyStore.save(apiKey);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_API_KEY");
    assert.doesNotMatch(JSON.stringify(result), /existing-key/);
  }
  assert.deepEqual(storage.values, { gateApiKey: "existing-key" });
});

test("save replaces an existing key and internal load returns only the new key", async () => {
  const storage = fakeStorage({ gateApiKey: "old-key" });
  const keyStore = createKeyStore(storage);

  await keyStore.save("new-key");

  assert.deepEqual(await keyStore.load(), {
    ok: true,
    data: { apiKey: "new-key" },
  });
  assert.doesNotMatch(JSON.stringify(await keyStore.status()), /new-key/);
});

test("clear removes the key and load reports missing configuration", async () => {
  const storage = fakeStorage({ gateApiKey: "test-key" });
  const keyStore = createKeyStore(storage);

  assert.deepEqual(await keyStore.clear(), {
    ok: true,
    data: { isConfigured: false },
  });
  assert.deepEqual(await keyStore.status(), {
    ok: true,
    data: { isConfigured: false },
  });
  assert.equal((await keyStore.load()).error.code, "NOT_CONFIGURED");
});

test("storage failures are redacted", async () => {
  const secret = "private-test-key";
  const storage = {
    async get() {
      throw new Error(`failed while reading ${secret}`);
    },
    async set() {
      throw new Error(`failed while writing ${secret}`);
    },
    async remove() {
      throw new Error(`failed while removing ${secret}`);
    },
  };
  const keyStore = createKeyStore(storage);

  for (const result of [
    await keyStore.save(secret),
    await keyStore.status(),
    await keyStore.load(),
    await keyStore.clear(),
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "UPSTREAM_ERROR");
    assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
  }
});
