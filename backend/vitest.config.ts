import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    // PostgreSQL integration suites share one database and create active cohorts.
    // Run them serially so fixtures do not violate the single-active-cohort rule.
    fileParallelism: process.env.RUN_DB_INTEGRATION !== "true",
  },
});
