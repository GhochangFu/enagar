/** Conventional Commits + a few project-specific scopes. */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        // apps
        'api',
        'citizen-pwa',
        'admin-tenant',
        'admin-state',
        'mobile',
        'staff-mobile',
        // packages
        'config',
        'types',
        'sdk',
        'forms',
        'i18n',
        'ui',
        'ui-native',
        'tenant-theme',
        'workflow',
        // services
        'workflow-engine',
        'notification-worker',
        'reporting-worker',
        'rag-indexer',
        // cross-cutting
        'infra',
        'ci',
        'docs',
        'deps',
        'security',
        'release',
        'repo',
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case']],
    'header-max-length': [2, 'always', 100],
  },
};
