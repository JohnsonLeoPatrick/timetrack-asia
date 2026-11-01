import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored skills, archived applications, and one-off migration utilities.
    "tools/**",
    ".agents/**",
    ".cache/**",
    "timetrack-asia/**",
    "scratch/**",
  ]),
  {
    files: ["tests/**/*.cjs", "scripts/**/*.js", "seed_test_data.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // This browser/server mock loads Node modules only inside server branches.
    files: ["src/lib/supabase/local-db.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
