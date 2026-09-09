import js from "@eslint/js";
import globals from "globals";
import ts from "typescript-eslint";

export default [
  { languageOptions: { globals: { ...globals.browser, chrome: "readonly" } } },
  js.configs.recommended,
  ...ts.configs.recommended,
  { ignores: ["dist/", "node_modules/"] },
];
