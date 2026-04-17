module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'services/**/*.js',
    'models/**/*.js',
    'controllers/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/'
  ],
  verbose: true,
  testTimeout: 30000
};