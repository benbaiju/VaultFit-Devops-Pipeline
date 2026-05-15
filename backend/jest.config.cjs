/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  injectGlobals: true,
  roots: ["<rootDir>"],
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
  },
  setupFiles: ["<rootDir>/tests/setup-env.ts"],
  clearMocks: true,
  /** One worker: `unstable_mockModule` for Supabase is process-wide; parallel files leak mocks. */
  maxWorkers: 1,
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/server.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      statements: 55,
      branches: 36,
      functions: 70,
      lines: 62,
    },
  },
};
