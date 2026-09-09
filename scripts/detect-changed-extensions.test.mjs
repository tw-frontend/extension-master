import assert from "node:assert/strict";
import test from "node:test";
import { detectChangedExtensions } from "./detect-changed-extensions.mjs";

const extensions = ["llm-gate-companion", "openrouter-deals", "sazeh-devtools"];

function detect(...files) {
  return detectChangedExtensions(files, extensions).sort();
}

test("generated registry changes do not republish existing extensions", () => {
  assert.deepEqual(
    detect(
      "extensions/llm-gate-companion/background.js",
      "packages/extension-registry/generated/extensions.json",
    ),
    ["llm-gate-companion"],
  );
});

test("shared source changes still select every extension", () => {
  assert.deepEqual(
    detect("packages/extension-registry/src/schema.ts"),
    ["llm-gate-companion", "openrouter-deals", "sazeh-devtools"],
  );
});

test("website and documentation changes do not create extension releases", () => {
  assert.deepEqual(
    detect("apps/web/lib/releases.ts", "docs/creating-extensions.md"),
    [],
  );
});
