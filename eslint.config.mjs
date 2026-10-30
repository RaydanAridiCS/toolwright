import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/coverage/**", "**/dist/**", "**/*.generated.ts", "**/next-env.d.ts", "playwright-report/**", "test-results/**", "apps/web/public/sw.js", "apps/web/public/pdfjs/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals,
  {
    settings: { next: { rootDir: "apps/web/" } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      // Setting state in effects is how this codebase hydrates browser-only state (localStorage, hash, clocks).
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
  {
    // Next's page/route modules and Playwright fixtures have conventional shapes.
    files: ["e2e/**", "scripts/**", "**/*.config.*", "vitest.setup.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
);
