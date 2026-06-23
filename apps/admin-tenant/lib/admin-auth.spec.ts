import { ACCESS_TOKEN_REFRESH_BUFFER_SEC, isAccessTokenExpiringSoon } from './admin-auth';
import { ADMIN_OAUTH_STORAGE_KEY, type AdminOAuthBundle } from './oauth/session-storage-keys';

describe('admin-auth token refresh helpers', () => {
  it('isAccessTokenExpiringSoon is true inside buffer window', () => {
    const auth: AdminOAuthBundle = {
      access_token: 'tok',
      expires_at: Math.floor(Date.now() / 1000) + 30,
    };
    expect(isAccessTokenExpiringSoon(auth, ACCESS_TOKEN_REFRESH_BUFFER_SEC)).toBe(true);
  });

  it('isAccessTokenExpiringSoon is false when expiry is far away', () => {
    const auth: AdminOAuthBundle = {
      access_token: 'tok',
      expires_at: Math.floor(Date.now() / 1000) + 600,
    };
    expect(isAccessTokenExpiringSoon(auth, ACCESS_TOKEN_REFRESH_BUFFER_SEC)).toBe(false);
  });
});

describe('admin oauth bundle', () => {
  it('allows optional refresh_token in stored payload shape', () => {
    const bundle: AdminOAuthBundle = {
      access_token: 'a',
      expires_at: 1,
      refresh_token: 'r',
      api_base_url: 'http://localhost:3001/api',
    };
    expect(bundle.refresh_token).toBe('r');
    expect(ADMIN_OAUTH_STORAGE_KEY).toBe('enagar.admin.oauth');
  });
});
