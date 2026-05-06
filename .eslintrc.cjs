/** Repo-root ESLint — covers commitlint, jest configs, and other root *.cjs files during lint-staged. */
module.exports = {
  root: true,
  extends: [require.resolve('@enagar/config/eslint/node')],
};
