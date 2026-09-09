import { failure, success } from "./result.js";

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
