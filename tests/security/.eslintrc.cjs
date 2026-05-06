module.exports = {
  root: true,
  extends: [require.resolve('@enagar/config/eslint/node')],
  env: {
    jest: true,
    node: true,
  },
};
