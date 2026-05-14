module.exports = {
  root: true,
  extends: [require.resolve('@enagar/config/eslint/node')],
  overrides: [
    {
      files: ['src/web/**/*.tsx'],
      extends: [require.resolve('@enagar/config/eslint/react-library')],
    },
  ],
};
