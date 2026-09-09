import assert from "node:assert/strict";
import test from "node:test";

import { createGateClient } from "../src/gate/client.js";

function response(body, { status = 200, jsonError } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      if (jsonError) {
        throw jsonError;
      }
      return body;
    },
  };
}

test("budget request encodes the key and uses private fetch options", async () => {
  let request;
  const client = createGateClient({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response({ remaining_budget: 7.5 });
    },
    now: () => new Date("2026-09-09T10:00:00.000Z"),
  });

  assert.deepEqual(await client.getBudget("key with/+symbols"), {
    ok: true,
    data: { remainingBudget: 7.5 },
    receivedAt: "2026-09-09T10:00:00.000Z",
  });
  const url = new URL(request.url);
  assert.equal(url.origin, "https://llm.simra.cloud");
  assert.equal(url.pathname, "/api/dashboard/budget");
  assert.equal(url.searchParams.get("api_key"), "key with/+symbols");
  assert.deepEqual(request.options.headers, { Accept: "application/json" });
  assert.equal(request.options.credentials, "omit");
  assert.equal(request.options.cache, "no-store");
  assert.ok(request.options.signal instanceof AbortSignal);
});

test("budget request maps authorization and rate-limit responses", async () => {
  for (const [status, code, retryable] of [
    [401, "UNAUTHORIZED", false],
    [403, "UNAUTHORIZED", false],
    [429, "RATE_LIMITED", true],
  ]) {
    const client = createGateClient({
      fetchImpl: async () => response(null, { status }),
    });
    const result = await client.getBudget("test-key");
    assert.equal(result.error.code, code);
    assert.equal(result.error.httpStatus, status);
    assert.equal(result.error.retryable, retryable);
  }
});

test("budget request maps other HTTP failures without reading their body", async () => {
  let jsonCalls = 0;
  const client = createGateClient({
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      async json() {
        jsonCalls += 1;
        return { detail: "may contain request information" };
      },
    }),
  });

  const result = await client.getBudget("test-key");

  assert.equal(result.error.code, "UPSTREAM_ERROR");
  assert.equal(result.error.httpStatus, 503);
  assert.equal(result.error.retryable, true);
  assert.equal(jsonCalls, 0);
});

test("budget request distinguishes timeout, network, JSON, and contract failures", async () => {
  const cases = [
    {
      fetchImpl: async () => {
        throw new DOMException("timed out with private-test-key", "TimeoutError");
      },
      code: "TIMEOUT",
    },
    {
      fetchImpl: async () => {
        throw new Error("offline with private-test-key");
      },
      code: "NETWORK_ERROR",
    },
    {
      fetchImpl: async () =>
        response(null, { jsonError: new Error("bad JSON private-test-key") }),
      code: "INVALID_RESPONSE",
    },
    {
      fetchImpl: async () => response({ remaining_budget: "wrong" }),
      code: "INVALID_RESPONSE",
    },
  ];

  for (const { fetchImpl, code } of cases) {
    const result = await createGateClient({ fetchImpl }).getBudget(
      "private-test-key",
    );
    assert.equal(result.error.code, code);
    assert.doesNotMatch(JSON.stringify(result), /private-test-key/);
  }
});

test("spend request adds the validated date range", async () => {
  let requestedUrl;
  const client = createGateClient({
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return response({
        total_spend: 2,
        avg_daily_spend: 1,
        spend_over_time: [],
        spend_by_model: [],
      });
    },
    now: () => new Date("2026-09-09T11:00:00.000Z"),
  });

  const result = await client.getSpend("test-key", {
    startDate: "2026-09-02",
    endDate: "2026-09-09",
  });

  assert.equal(result.ok, true);
  assert.equal(result.receivedAt, "2026-09-09T11:00:00.000Z");
  assert.equal(requestedUrl.pathname, "/api/dashboard/spend");
  assert.equal(requestedUrl.searchParams.get("api_key"), "test-key");
  assert.equal(requestedUrl.searchParams.get("start_date"), "2026-09-02");
  assert.equal(requestedUrl.searchParams.get("end_date"), "2026-09-09");
});

test("spend request rejects an invalid range without fetching", async () => {
  let fetchCalls = 0;
  const client = createGateClient({
    fetchImpl: async () => {
      fetchCalls += 1;
      return response({});
    },
  });

  const result = await client.getSpend("test-key", {
    startDate: "2026-09-10",
    endDate: "2026-09-09",
  });

  assert.equal(result.error.code, "INVALID_DATE_RANGE");
  assert.equal(fetchCalls, 0);
});
