import { createGateClient } from "./src/gate/client.js";
import { validateDateRange } from "./src/gate/date-range.js";
import { createKeyStore } from "./src/gate/key-store.js";
import { failure, success } from "./src/gate/result.js";

const COMMAND_ERROR = "The gate command could not be completed.";
const RESOURCE_ERROR = "The LLM Gate resource could not be loaded.";

async function settleResource(load) {
  try {
    return await load();
  } catch {
    return failure("UPSTREAM_ERROR", RESOURCE_ERROR, true);
  }
}

export function createCommandHandler(keyStore, gateClient) {
  return async function handleCommand(command) {
    if (!command || typeof command !== "object") {
      return failure("UPSTREAM_ERROR", COMMAND_ERROR, false);
    }

    switch (command.type) {
      case "gate/configure":
        return keyStore.save(command.apiKey);
      case "gate/status":
        return keyStore.status();
      case "gate/clear":
        return keyStore.clear();
      case "gate/load": {
        const range = validateDateRange(command.range);
        if (!range.ok) {
          return range;
        }
        const configured = await keyStore.load();
        if (!configured.ok) {
          return configured;
        }
        const [budget, spend, requests] = await Promise.all([
          settleResource(() => gateClient.getBudget(configured.data.apiKey)),
          settleResource(() =>
            gateClient.getSpend(configured.data.apiKey, range.data),
          ),
          settleResource(() =>
            gateClient.getRequests(configured.data.apiKey, range.data),
          ),
        ]);
        return success({ budget, spend, requests });
      }
      default:
        return failure("UPSTREAM_ERROR", COMMAND_ERROR, false);
    }
  };
}

export function createMessageListener(handleCommand) {
  return function onMessage(message, _sender, respond) {
    Promise.resolve(handleCommand(message))
      .then(respond)
      .catch(() => {
        respond(failure("UPSTREAM_ERROR", COMMAND_ERROR, true));
      });
    return true;
  };
}

if (globalThis.chrome?.runtime?.onMessage && globalThis.chrome?.storage?.local) {
  const handleCommand = createCommandHandler(
    createKeyStore(globalThis.chrome.storage.local),
    createGateClient(),
  );
  globalThis.chrome.runtime.onMessage.addListener(
    createMessageListener(handleCommand),
  );
}
