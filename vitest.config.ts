import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // PDF tests embed full Unicode fonts and can exceed the 5s default on slower or busy machines.
    testTimeout: 30000,
  },
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
});