import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
export default defineConfig([
  { ignores: ["node_modules/**", "dist/**", "main.js", "research/**"] },
  {
    files: ["src/**/*.js", "manifest.json", "package.json", "LICENSE"],
    ignores: ["src/browser.js"],
    extends: obsidianmd.configs.recommended,
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: [
      "mcp/**/*.mjs",
      "scripts/**/*.mjs",
      "tests/**/*.mjs",
      "*.mjs",
      "src/browser.js",
    ],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
]);
