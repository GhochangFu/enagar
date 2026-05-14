module.exports = {
  root: true,
  ignorePatterns: ['dist', '.expo', '*.config.js'],
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      parser: '@typescript-eslint/parser',
      plugins: ['react', 'react-hooks'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      settings: {
        react: { version: 'detect' },
      },
      env: {
        es2024: true,
        browser: true,
      },
      globals: {
        process: 'readonly',
        __DEV__: 'readonly',
      },
      extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
      rules: {
        // TypeScript-unused binding noise without the full `@typescript-eslint` plugin graph.
        'no-unused-vars': 'off',
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
      },
    },
    {
      files: ['**/*.selftest.ts'],
      parser: '@typescript-eslint/parser',
      env: {
        node: true,
        es2024: true,
      },
      extends: ['eslint:recommended'],
      rules: { 'no-unused-vars': 'off' },
    },
  ],
};
