module.exports = {
  root: true,
  extends: [require.resolve('@enagar/config/eslint/node')],
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
};
