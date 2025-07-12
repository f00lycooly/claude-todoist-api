// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '0'; // Use random available port

// Increase timeout for slower operations
jest.setTimeout(15000);

// Suppress console output during tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Global cleanup
afterAll(async () => {
  // Wait a bit for cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
});
