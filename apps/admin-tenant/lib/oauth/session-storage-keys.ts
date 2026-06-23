export const ADMIN_OAUTH_STORAGE_KEY = 'enagar.admin.oauth';

export type AdminOAuthBundle = {
  access_token: string;
  expires_at: number;
  refresh_token?: string;
  /** Written at login so the SPA targets the correct API prefix without rebuilding. */
  api_base_url?: string;
};
