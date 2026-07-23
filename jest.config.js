/**
 * Component tests only (.test.tsx) — pure-logic tests (.test.ts) run under
 * vitest (see vitest.config.ts). Keep the two suites' globs disjoint.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/src/**/*.test.tsx'],
  clearMocks: true,
};
