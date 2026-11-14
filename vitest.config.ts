import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['contracts/**/src/**/*.test.ts', 'installers/core/**/src/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/vendor/**', 'copilot/**'],
    // Until the first unit test lands (T054, contracts/lib); remove it then so an empty run fails.
    passWithNoTests: true,
  },
});
