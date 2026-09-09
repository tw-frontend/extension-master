import assert from "node:assert/strict";
import test from "node:test";

import { failure, success } from "../src/gate/result.js";

test("success returns data with the supplied receipt timestamp", () => {
  assert.deepEqual(success({ remainingBudget: 8 }, "2026-09-09T10:00:00.000Z"), {
    ok: true,
    data: { remainingBudget: 8 },
    receivedAt: "2026-09-09T10:00:00.000Z",
  });
});

test("failure omits an absent HTTP status", () => {
  assert.deepEqual(failure("TIMEOUT", "The request timed out.", true), {
    ok: false,
    error: {
      code: "TIMEOUT",
      message: "The request timed out.",
      retryable: true,
    },
  });
});

test("failure includes a supplied HTTP status", () => {
  assert.deepEqual(failure("UNAUTHORIZED", "The API key was rejected.", false, 403), {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "The API key was rejected.",
      retryable: false,
      httpStatus: 403,
    },
  });
});
