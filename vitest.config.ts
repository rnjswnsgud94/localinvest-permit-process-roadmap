import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/helpers/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // The dashboard exercises the full 175-procedure catalog in one DOM. A
    // single interaction remains well below this limit in isolation, while
    // the extra headroom prevents worker contention on shared CI runners from
    // turning successful interactions into timer-starvation failures.
    testTimeout: 30_000,
    coverage: {
      reporter: ["text", "json-summary"],
      include: ["lib/**/*.ts", "app/components/dashboard/**/*.tsx"],
    },
  },
});
