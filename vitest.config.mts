import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Next.js guards server modules with "server-only"; in tests it is a no-op.
      "server-only": path.resolve(import.meta.dirname, "tests/stub-server-only.ts"),
    },
  },
});
