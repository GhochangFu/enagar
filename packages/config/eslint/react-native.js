// ESLint preset for React Native (Expo) apps: mobile, staff-mobile.

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    require.resolve('./base.js'),
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: { version: 'detect' },
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
};
