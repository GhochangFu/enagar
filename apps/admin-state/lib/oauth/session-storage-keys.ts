export const STATE_OAUTH_STORAGE_KEY = 'enagar.state.oauth';

export type StateOAuthBundle = {
  access_token: string;
  expires_at: number;
  api_base_url?: string;
};
