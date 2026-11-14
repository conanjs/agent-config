import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'contracts/**/src/**/*.test.ts',
      'installers/core/**/src/**/*.test.ts',
      'scripts/**/*.test.ts',
      'eslint/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/vendor/**', 'copilot/**'],
  },
});
