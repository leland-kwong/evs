module.exports = {
  transform: {
    '^.+\\.[t|j]s?$': 'babel-jest',
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['js'],
  moduleNameMapper: {},
  testMatch: ['**/*.test.(js|jsx)'],
  testPathIgnorePatterns: ['./node_modules/'],
  globals: {},
};
