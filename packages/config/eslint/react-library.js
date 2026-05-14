/** Shared ESLint preset for workspace React **libraries** (no Next.js `pages/` directory). */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  env: {
    browser: true,
    es2022: true,
  },
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
  extends: [
    require.resolve('./base.js'),
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: { version: 'detect' },
    'import/resolver': {
      typescript: { alwaysTryTypes: true },
      node: true,
    },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
};
