import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Security rules (SECURITY_REQUIREMENTS SEC-30/31): no raw HTML, no raw SQL in application code.
    files: ["src/**/*.{ts,tsx}", "worker/**/*.ts", "scripts/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Raw HTML is not allowed. Render text, or use the legal Markdown renderer.",
        },
        {
          selector: "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
          message: "sql.raw bypasses parameterisation. Use the sql`` template with parameters.",
        },
      ],
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
  {
    // Pages and components go through modules (which apply authorisation); never the database directly.
    files: ["src/app/**/*.{ts,tsx}", "src/ui/**/*.{ts,tsx}"],
    ignores: ["src/app/healthz/**", "src/app/media/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@/db/client", message: "Use a module in src/modules (authorisation lives there)." }] },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "drizzle/**",
    ".data/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
