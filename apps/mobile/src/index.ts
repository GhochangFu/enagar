export const sprint13CitizenFlow = [
  'splash',
  'language',
  'login',
  'otp',
  'tenant-picker',
  'empty-home',
] as const;

export type Sprint13CitizenFlowStep = (typeof sprint13CitizenFlow)[number];

export const mobileShellStatus = {
  app: '@enagar/mobile',
  implementation: 'Phase 5 native shell pending; Sprint 1.3 flow contract is shared with PWA.',
  tokenStorage: 'Expo SecureStore required when native shell starts.',
  apiRoutes: [
    'POST /auth/send-otp',
    'POST /auth/verify-otp',
    'GET /tenants',
    'GET /tenants/:id/config',
    'POST /citizen/select-tenant',
  ],
};
