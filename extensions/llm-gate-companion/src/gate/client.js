import { parseBudgetResponse, parseSpendResponse } from "./contracts.js";
import { validateDateRange } from "./date-range.js";
import { failure, success } from "./result.js";

const BASE_URL = "https://llm.simra.cloud";

function httpFailure(status) {
  if (status === 401 || status === 403) {
    return failure(
      "UNAUTHORIZED",
      "The LLM Gate rejected the API key.",
      false,
      status,
    );
  }
  if (status === 429) {
    return failure(
      "RATE_LIMITED",
      "The LLM Gate is rate limiting requests. Try again later.",
      true,
      status,
    );
  }
  return failure(
    "UPSTREAM_ERROR",
    "The LLM Gate request failed.",
    status >= 500,
    status,
  );
}

function buildUrl(path, apiKey, range) {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("api_key", apiKey);
  if (range) {
    url.searchParams.set("start_date", range.startDate);
    url.searchParams.set("end_date", range.endDate);
  }
  return url;
}

export function createGateClient({
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  timeoutMs = 10_000,
} = {}) {
  async function request(path, apiKey, parseResponse, range) {
    let response;
    try {
      response = await fetchImpl(buildUrl(path, apiKey, range).toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return failure("TIMEOUT", "The LLM Gate request timed out.", true);
      }
      return failure(
        "NETWORK_ERROR",
        "The LLM Gate could not be reached.",
        true,
      );
    }

    if (!response.ok) {
      return httpFailure(response.status);
    }

    let body;
    try {
      body = await response.json();
    } catch {
      return failure(
        "INVALID_RESPONSE",
        "The LLM Gate returned invalid JSON.",
        true,
      );
    }

    const parsed = parseResponse(body);
    return parsed.ok
      ? success(parsed.data, now().toISOString())
      : parsed;
  }

  return {
    getBudget(apiKey) {
      return request("/api/dashboard/budget", apiKey, parseBudgetResponse);
    },
    getSpend(apiKey, range) {
      const validated = validateDateRange(range);
      return validated.ok
        ? request(
            "/api/dashboard/spend",
            apiKey,
            parseSpendResponse,
            validated.data,
          )
        : Promise.resolve(validated);
    },
  };
}
