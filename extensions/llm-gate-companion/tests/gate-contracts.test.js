import assert from "node:assert/strict";
import test from "node:test";

import { parseBudgetResponse } from "../src/gate/contracts.js";

test("budget response normalizes a finite remaining budget", () => {
  assert.deepEqual(parseBudgetResponse({ remaining_budget: 7.9196000978 }), {
    ok: true,
    data: { remainingBudget: 7.9196000978 },
  });
});

test("budget response rejects missing, mistyped, and non-finite values", () => {
  for (const body of [
    null,
    {},
    { remaining_budget: "7.9" },
    { remaining_budget: Number.NaN },
    { remaining_budget: Number.POSITIVE_INFINITY },
  ]) {
    const result = parseBudgetResponse(body);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_RESPONSE");
  }
});
