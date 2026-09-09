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

function isRequestsOverTimeRow(row) {
  return (
    row &&
    typeof row === "object" &&
    isValidDate(row.date) &&
    isFiniteNumber(row.count)
  );
}

function isRequestsByModelRow(row) {
  return (
    row &&
    typeof row === "object" &&
    typeof row.model === "string" &&
    row.model.trim() !== "" &&
    isFiniteNumber(row.count)
  );
}

export function parseRequestsResponse(body) {
  if (
    !body ||
    typeof body !== "object" ||
    !isFiniteNumber(body.total_requests) ||
    !Array.isArray(body.requests_over_time) ||
    !body.requests_over_time.every(isRequestsOverTimeRow) ||
    !Array.isArray(body.requests_by_model) ||
    !body.requests_by_model.every(isRequestsByModelRow) ||
    !isFiniteNumber(body.avg_spend_per_request) ||
    !isFiniteNumber(body.rank_by_avg_spend) ||
    !isFiniteNumber(body.rank_by_spend) ||
    !isFiniteNumber(body.total_users) ||
    !isFiniteNumber(body.total_users_spend) ||
    !isFiniteNumber(body.user_rank)
  ) {
    return invalidResponse();
  }

  return success({
    totalRequests: body.total_requests,
    requestsOverTime: body.requests_over_time.map(({ date, count }) => ({
      date,
      count,
    })),
    requestsByModel: body.requests_by_model.map(({ model, count }) => ({
      model,
      count,
    })),
    averageSpendPerRequest: body.avg_spend_per_request,
    rankByAverageSpend: body.rank_by_avg_spend,
    rankBySpend: body.rank_by_spend,
    totalUsers: body.total_users,
    totalUsersSpend: body.total_users_spend,
    userRank: body.user_rank,
  });
}
