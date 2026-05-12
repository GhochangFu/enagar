module.exports = {
  root: true,
  ignorePatterns: ['lib/**/*.spec.ts'],
  extends: [require.resolve('@enagar/config/eslint/next')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
