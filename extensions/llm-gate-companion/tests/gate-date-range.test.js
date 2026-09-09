import assert from "node:assert/strict";
import test from "node:test";

import { validateDateRange } from "../src/gate/date-range.js";

test("accepts a valid inclusive range unchanged", () => {
  assert.deepEqual(
    validateDateRange({ startDate: "2026-09-02", endDate: "2026-09-09" }),
    {
      ok: true,
      data: { startDate: "2026-09-02", endDate: "2026-09-09" },
    },
  );
});

test("accepts a same-day range and a real leap day", () => {
  assert.equal(
    validateDateRange({ startDate: "2024-02-29", endDate: "2024-02-29" })
      .ok,
    true,
  );
  assert.equal(
    validateDateRange({ startDate: "2000-02-29", endDate: "2000-02-29" })
      .ok,
    true,
  );
});

test("rejects missing, malformed, and impossible dates", () => {
  const invalidRanges = [
    {},
    { startDate: "", endDate: "2026-09-09" },
    { startDate: "2026-9-02", endDate: "2026-09-09" },
    { startDate: "2026-02-29", endDate: "2026-09-09" },
    { startDate: "2026-04-31", endDate: "2026-09-09" },
    { startDate: "2026-00-01", endDate: "2026-09-09" },
    { startDate: "2026-01-01", endDate: "2026-13-01" },
    { startDate: "0000-01-01", endDate: "2026-09-09" },
    { startDate: "1900-02-29", endDate: "2026-09-09" },
    { startDate: "2026-01-00", endDate: "2026-09-09" },
    { startDate: "2026-01-32", endDate: "2026-09-09" },
    { startDate: 20260902, endDate: "2026-09-09" },
  ];

  for (const range of invalidRanges) {
    const result = validateDateRange(range);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_DATE_RANGE");
    assert.equal(result.error.retryable, false);
  }
});

test("rejects a range whose start is after its end", () => {
  assert.deepEqual(
    validateDateRange({ startDate: "2026-09-10", endDate: "2026-09-09" }),
    {
      ok: false,
      error: {
        code: "INVALID_DATE_RANGE",
        message: "Start date must be on or before end date.",
        retryable: false,
      },
    },
  );
});
