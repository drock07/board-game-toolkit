import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**"] },

  js.configs.recommended,

  // TypeScript, with type-aware rules
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // Determinism: the engine and game rules get randomness only from the seeded
  // RNG in state, and never read the clock (decision D12)
  {
    files: ["packages/engine/src/**/*.ts", "examples/src/games/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "Game state must not depend on the clock." },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "Use tx.random (the seeded RNG in state) instead.",
        },
      ],
    },
  },

  // Test doubles often satisfy async interfaces without awaiting anything
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: { "@typescript-eslint/require-await": "off" },
  },

  // React
  {
    files: ["packages/react/**/*.{ts,tsx}", "examples/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
  },

  // Library components must not depend on the consumer's CSS (see #20)
  {
    files: ["packages/react/src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name='className'] :matches(Literal, TemplateLiteral)",
          message:
            "Library components must not hard-code class names; use inline styles and pass `className` through.",
        },
      ],
    },
  },

  // Node-run config files
  {
    files: ["*.{js,mjs}", "examples/vite.config.ts"],
    languageOptions: { globals: globals.node },
  },

  // Must be last: turns off rules that conflict with Prettier
  prettier,
);
