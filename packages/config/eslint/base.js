// Base ESLint config (flat-config compatible export, but emitted in
// `extends`-friendly shape so legacy .eslintrc.json files can `extends`
// from this preset until we migrate the entire repo to flat config.)
//
// Apps with framework-specific needs should `extends` this and one of:
//   • @enagar/config/eslint/node
//   • @enagar/config/eslint/next
//   • @enagar/config/eslint/react-native

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: false,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: { alwaysTryTypes: true },
      node: true,
    },
  },
  rules: {
    // Type safety — strict but pragmatic
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'off', // handled by unused-imports
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
    ],

    // Import hygiene
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-duplicates': 'error',
    'import/no-default-export': 'off',

    // General correctness
    eqeqeq: ['error', 'smart'],
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'error',
    'prefer-const': 'error',
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    'coverage',
    '*.config.{js,mjs,cjs}',
    '**/.eslintrc.cjs',
  ],
};
