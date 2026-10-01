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
      // The state machine's start/advance/dispatch results never reject (errors
      // go to onError), so they're safe to fire and forget
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafePromises: [
            {
              from: "package",
              name: "OperationResult",
              package: "@drock07/board-game-toolkit-react",
            },
            // Inside this workspace the package resolves through its symlink to
            // its own build output; the path is relative to the examples project
            {
              from: "file",
              name: "OperationResult",
              path: "../packages/react/dist/stateMachine/StateMachineContext.d.ts",
            },
          ],
        },
      ],
      // Warnings until the `any` cleanup in #28, which promotes them to errors
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
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

  // The examples app passes promise-returning callbacks (e.g. `advance`) to
  // event handler props, which is idiomatic in React
  {
    files: ["examples/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
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
