import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["eval/**/*.eval.ts"], environment: "node" },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
