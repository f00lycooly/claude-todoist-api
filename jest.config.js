module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '!**/tests/backup/**',  // Ignore backup directory
    '!**/tests/old/**',     // Ignore old directory
    '!**/node_modules/**'   // Ignore node_modules
  ],
  testTimeout: 15000,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js'
  ],
  coverageDirectory: 'coverage'
};
