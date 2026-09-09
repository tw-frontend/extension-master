import { createKeyStore } from "./src/gate/key-store.js";
import { failure } from "./src/gate/result.js";

const COMMAND_ERROR = "The gate command could not be completed.";

export function createCommandHandler(keyStore) {
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
  );
  globalThis.chrome.runtime.onMessage.addListener(
    createMessageListener(handleCommand),
  );
}
