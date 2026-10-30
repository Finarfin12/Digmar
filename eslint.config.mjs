import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Pola "fetch saat mount lalu set loading" dipakai di banyak halaman; ditandai sebagai warning
      // agar tetap terlihat tanpa memblokir lint. Perbaiki bertahap (mis. pindah ke data fetching server).
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // UI dashboard masih memakai `any` untuk state data API; kode server/lib tetap wajib bertipe
    files: ["src/app/(dashboard)/**/*.tsx", "src/components/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
