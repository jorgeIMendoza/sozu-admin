import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // `supabase/functions/` está prácticamente vacío a propósito: las Edge Functions
  // viven en el repo `sozu-edge-functions` y corren en Deno, no en este bundle.
  { ignores: ["dist", "supabase/functions"] },
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
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // El repo usa `as any` a propósito para las tablas que no están en los
      // tipos generados de Supabase (patrón #8 de CLAUDE.md). La regla marcaba
      // 7545 usos legítimos y tapaba los errores que sí importan.
      "@typescript-eslint/no-explicit-any": "off",
      // `cond && hacer()` y `a ? b() : c()` como sentencia son el idioma del repo
      // para alternar Sets dentro de los setState.
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowShortCircuit: true, allowTernary: true },
      ],
      // `catch {}` es el patrón del repo para las consultas best-effort (columnas
      // opcionales, enriquecimientos que no deben tumbar la vista).
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    // Config de Tailwind: los plugins se cargan con require(), que es como los
    // documenta Tailwind.
    files: ["tailwind.config.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
