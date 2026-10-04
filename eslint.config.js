import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Generated files, never edited by hand: the Supabase integration (Lovable) and the
    // MCP routes (@lovable.dev/mcp-js regenerates them).
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      "public",
      "src/integrations/supabase/types.ts",
      "src/integrations/supabase/auth-middleware.ts",
      "src/integrations/supabase/client.ts",
      "src/integrations/supabase/client.server.ts",
      "src/integrations/supabase/previewAuthStorage.ts",
      "src/routes/mcp.ts",
      "src/routes/\\[.mcp\\]/**",
      "src/routes/\\[.well-known\\]/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Deep research portability (plan A5): steps, parsers, report logic and the LLM layer
    // import nothing from the app, TanStack or React and never read process.env, so they
    // can move to Cloudflare Workflows unchanged. A folder block replaces the rule's global
    // options, so the server-only entry above is repeated here.
    files: ["src/lib/deep/{steps,parse,report,llm}/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
          patterns: [
            {
              group: ["@/*"],
              message: "Deep steps get everything through StepEnv (src/lib/deep/env.server.ts).",
            },
            {
              group: ["@tanstack/*", "react", "react-dom"],
              message: "Deep steps, parsers and the LLM layer stay framework-free.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: "Read configuration in env.server.ts and pass it through StepEnv.",
        },
      ],
    },
  },
  eslintPluginPrettier,
);
