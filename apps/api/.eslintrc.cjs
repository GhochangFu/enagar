module.exports = {
  root: true,
  extends: [require.resolve('@enagar/config/eslint/node')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
