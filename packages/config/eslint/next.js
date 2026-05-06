// ESLint preset for Next.js apps (citizen-pwa, admin-tenant, admin-state).
//
// `next/core-web-vitals` already extends:
//   - eslint:recommended
//   - plugin:react/recommended
//   - plugin:react-hooks/recommended
//   - plugin:jsx-a11y/recommended (via @next/eslint-plugin-next)
// so we deliberately do NOT re-list them — duplicate `plugins`
// declarations or duplicate transitive copies cause ESLint to fail
// with "couldn't determine the plugin uniquely" errors in pnpm
// monorepos.

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [require.resolve('./base.js'), 'next/core-web-vitals'],
  settings: {
    react: { version: 'detect' },
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'import/no-default-export': 'off',
  },
};
