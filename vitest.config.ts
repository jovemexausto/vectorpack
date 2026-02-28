import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts', 'packages/**/__tests__/**/*.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['packages/**/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/dist/**'],
    },
  },
})
