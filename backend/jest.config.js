/** Integration tests run against a real Postgres (DATABASE_URL_TEST), serially. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testRegex: '\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  testTimeout: 20000,
  watchman: false, // file watching isn't needed for a one-shot run
};
