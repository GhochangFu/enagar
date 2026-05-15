module.exports = {
  root: true,
  ignorePatterns: ['lib/**/*.spec.ts'],
  extends: [require.resolve('@enagar/config/eslint/next')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // App Router only — no `pages/` directory in this package.
    '@next/next/no-html-link-for-pages': 'off',
  },
};
