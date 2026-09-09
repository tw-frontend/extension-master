import assert from "node:assert/strict";
import test from "node:test";

import {
  parseBudgetResponse,
  parseSpendResponse,
} from "../src/gate/contracts.js";

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

test("spend response normalizes totals, daily rows, and model rows", () => {
  assert.deepEqual(
    parseSpendResponse({
      total_spend: 9.48354441069999,
      avg_daily_spend: 1.1854430513374987,
      spend_over_time: [
        { date: "2026-09-02", total: 1.7872516333999997 },
        { date: "2026-09-09", total: 0.17498154 },
      ],
      spend_by_model: [
        { model: "glm-5.3-flash", total: 1.8434155749999992 },
        { model: "gpt-5.6-luna-pro", total: 6.32989122 },
      ],
    }),
    {
      ok: true,
      data: {
        totalSpend: 9.48354441069999,
        averageDailySpend: 1.1854430513374987,
        spendOverTime: [
          { date: "2026-09-02", total: 1.7872516333999997 },
          { date: "2026-09-09", total: 0.17498154 },
        ],
        spendByModel: [
          { model: "glm-5.3-flash", total: 1.8434155749999992 },
          { model: "gpt-5.6-luna-pro", total: 6.32989122 },
        ],
      },
    },
  );
});

test("spend response accepts empty analytics arrays", () => {
  assert.equal(
    parseSpendResponse({
      total_spend: 0,
      avg_daily_spend: 0,
      spend_over_time: [],
      spend_by_model: [],
    }).ok,
    true,
  );
});

test("spend response rejects malformed top-level and nested values", () => {
  const valid = {
    total_spend: 1,
    avg_daily_spend: 1,
    spend_over_time: [{ date: "2026-09-09", total: 1 }],
    spend_by_model: [{ model: "test-model", total: 1 }],
  };
  const invalidBodies = [
    null,
    { ...valid, total_spend: "1" },
    { ...valid, avg_daily_spend: Number.NaN },
    { ...valid, spend_over_time: null },
    { ...valid, spend_by_model: {} },
    { ...valid, spend_over_time: [{ date: "2026-9-9", total: 1 }] },
    { ...valid, spend_over_time: [{ date: "2026-09-09", total: Infinity }] },
    { ...valid, spend_by_model: [{ model: "", total: 1 }] },
    { ...valid, spend_by_model: [{ model: "test-model", total: "1" }] },
  ];

  for (const body of invalidBodies) {
    assert.equal(parseSpendResponse(body).error.code, "INVALID_RESPONSE");
  }
});
