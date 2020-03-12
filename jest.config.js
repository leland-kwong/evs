module.exports = {
  transform: {
    '^.+\\.[t|j]s?$': 'babel-jest',
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['js'],
  moduleNameMapper: {},
  testMatch: ['**/*.test.(js|jsx)'],
  testPathIgnorePatterns: ['./node_modules/'],
  transformIgnorePatterns: [
    'node_modules/(?!(atomic-state)/)',
  ],
  globals: {
    window: {},
    document: {
      addEventListener() {},
      removeEventListener() {},
    },
  },
};
