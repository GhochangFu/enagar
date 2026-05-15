import { pkceChallengeS256, randomPkceVerifier } from './pkce';

describe('pkce', () => {
  it('produces verifier and deterministic challenge', () => {
    const v = randomPkceVerifier();
    expect(v.length).toBeGreaterThan(40);
    const c1 = pkceChallengeS256(v);
    const c2 = pkceChallengeS256(v);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
