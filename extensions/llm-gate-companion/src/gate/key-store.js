import { failure, success } from "./result.js";

const STORAGE_KEY = "gateApiKey";
const STORAGE_ERROR = "Local extension storage is unavailable.";

function normalizeApiKey(apiKey) {
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    return null;
  }
  return apiKey.trim();
}

export function createKeyStore(storage) {
  return {
    async save(apiKey) {
      const normalized = normalizeApiKey(apiKey);
      if (!normalized) {
        return failure(
          "INVALID_API_KEY",
          "Enter a non-empty API key.",
          false,
        );
      }

      try {
        await storage.set({ [STORAGE_KEY]: normalized });
        return success({ isConfigured: true });
      } catch {
        return failure("UPSTREAM_ERROR", STORAGE_ERROR, true);
      }
    },

    async status() {
      try {
        const stored = await storage.get(STORAGE_KEY);
        return success({
          isConfigured: normalizeApiKey(stored[STORAGE_KEY]) !== null,
        });
      } catch {
        return failure("UPSTREAM_ERROR", STORAGE_ERROR, true);
      }
    },

    async load() {
      try {
        const stored = await storage.get(STORAGE_KEY);
        const apiKey = normalizeApiKey(stored[STORAGE_KEY]);
        return apiKey
          ? success({ apiKey })
          : failure(
              "NOT_CONFIGURED",
              "Configure an API key before loading dashboard data.",
              false,
            );
      } catch {
        return failure("UPSTREAM_ERROR", STORAGE_ERROR, true);
      }
    },

    async clear() {
      try {
        await storage.remove(STORAGE_KEY);
        return success({ isConfigured: false });
      } catch {
        return failure("UPSTREAM_ERROR", STORAGE_ERROR, true);
      }
    },
  };
}
