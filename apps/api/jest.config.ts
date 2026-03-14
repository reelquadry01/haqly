import type { Config } from 'jest';
const config: Config = {
  verbose: false,
  testMatch: ['**/*.spec.ts'],
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/',
  },
};
export default config;

