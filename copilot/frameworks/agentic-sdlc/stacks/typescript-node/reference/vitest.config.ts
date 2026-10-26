import { defineConfig } from "vitest/config";

// Unit tests sit next to the code they test; tsconfigPaths makes the @/ aliases resolve (TSN-15).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ["src/**/*.test.ts"] },
});
