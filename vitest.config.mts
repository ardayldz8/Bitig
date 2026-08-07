import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * İki proje: saf mantık testleri Node'da, bileşen testleri jsdom'da.
 *
 * Tek ortam kullanmak iki yönden de kötü olurdu: her şeyi jsdom'da koşturmak
 * saf fonksiyon testlerini gereksiz yavaşlatır, her şeyi Node'da koşturmak
 * bileşen testlerini imkânsız kılar.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "mantik",
          environment: "node",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "bilesen",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
          setupFiles: ["tests/setup.ts"],
        },
      },
    ],
  },
});
