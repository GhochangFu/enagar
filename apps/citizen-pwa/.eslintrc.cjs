module.exports = {
  root: true,
  extends: [require.resolve('@enagar/config/eslint/next')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
