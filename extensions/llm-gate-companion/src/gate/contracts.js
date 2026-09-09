import { failure, success } from "./result.js";
import { validateDateRange } from "./date-range.js";

const INVALID_RESPONSE_MESSAGE = "The LLM Gate returned unexpected data.";

function invalidResponse() {
  return failure("INVALID_RESPONSE", INVALID_RESPONSE_MESSAGE, true);
}

export function parseBudgetResponse(body) {
  if (
    !body ||
    typeof body !== "object" ||
    !Number.isFinite(body.remaining_budget)
  ) {
    return invalidResponse();
  }

  return success({ remainingBudget: body.remaining_budget });
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidDate(value) {
  return validateDateRange({ startDate: value, endDate: value }).ok;
}

function isSpendOverTimeRow(row) {
  return (
    row &&
    typeof row === "object" &&
    isValidDate(row.date) &&
    isFiniteNumber(row.total)
  );
}

function isSpendByModelRow(row) {
  return (
    row &&
    typeof row === "object" &&
    typeof row.model === "string" &&
    row.model.trim() !== "" &&
    isFiniteNumber(row.total)
  );
}

export function parseSpendResponse(body) {
  if (
    !body ||
    typeof body !== "object" ||
    !isFiniteNumber(body.total_spend) ||
    !isFiniteNumber(body.avg_daily_spend) ||
    !Array.isArray(body.spend_over_time) ||
    !body.spend_over_time.every(isSpendOverTimeRow) ||
    !Array.isArray(body.spend_by_model) ||
    !body.spend_by_model.every(isSpendByModelRow)
  ) {
    return invalidResponse();
  }

  return success({
    totalSpend: body.total_spend,
    averageDailySpend: body.avg_daily_spend,
    spendOverTime: body.spend_over_time.map(({ date, total }) => ({
      date,
      total,
    })),
    spendByModel: body.spend_by_model.map(({ model, total }) => ({
      model,
      total,
    })),
  });
}
