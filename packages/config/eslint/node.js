// ESLint preset for Node-side packages (NestJS API, BullMQ workers, scripts).

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [require.resolve('./base.js')],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Node-specific: allow CommonJS in config files; otherwise prefer ESM.
    '@typescript-eslint/no-require-imports': 'error',
  },
};
