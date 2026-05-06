/** Standalone Jest config for cross-cutting security tests. */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { target: 'es2022', module: 'commonjs', strict: true } }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  passWithNoTests: false,
};
