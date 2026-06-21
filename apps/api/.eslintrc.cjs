module.exports = {
  root: true,
  extends: [require.resolve('@enagar/config/eslint/node')],
  ignorePatterns: ['scripts/**/*.mjs'],
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
};
