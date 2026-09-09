import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildDashboardSummary,
  getJalaliMonthStatus,
  summarizeModels,
} from "../src/popup-model.js";

test("the browser action opens the dashboard popup", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
  );

  assert.equal(manifest.action.default_popup, "popup.html");
});

test("defaults usage dates to the current Jalali month through today", () => {
  const status = getJalaliMonthStatus(new Date("2026-09-09T12:00:00Z"));

  assert.deepEqual(status, {
    label: "Shahrivar 1405",
    startDate: "2026-08-23",
    endDate: "2026-09-09",
    day: 18,
    daysInMonth: 31,
    daysRemaining: 13,
    progressPercent: 58,
  });
});

test("combines and orders model usage without losing either metric", () => {
  assert.deepEqual(
    summarizeModels(
      [
        { model: "model-b", total: 7 },
        { model: "model-a", total: 2 },
      ],
      [
        { model: "model-a", count: 20 },
        { model: "model-c", count: 3 },
      ],
    ),
    [
      { model: "model-b", spend: 7, requests: 0 },
      { model: "model-a", spend: 2, requests: 20 },
      { model: "model-c", spend: 0, requests: 3 },
    ],
  );
});

test("builds a usable dashboard when one resource fails", () => {
  const summary = buildDashboardSummary({
    budget: { ok: true, data: { remainingBudget: 7.5 } },
    spend: {
      ok: true,
      data: {
        totalSpend: 9.25,
        averageDailySpend: 1.2,
        spendByModel: [{ model: "model-a", total: 9.25 }],
      },
    },
    requests: {
      ok: false,
      error: { message: "Request analytics are unavailable." },
    },
  });

  assert.deepEqual(summary, {
    remainingBudget: 7.5,
    totalSpend: 9.25,
    averageDailySpend: 1.2,
    totalRequests: null,
    averageSpendPerRequest: null,
    optimizationRank: null,
    overallRank: null,
    totalUsers: null,
    models: [{ model: "model-a", spend: 9.25, requests: 0 }],
    errors: ["Request analytics are unavailable."],
  });
});
