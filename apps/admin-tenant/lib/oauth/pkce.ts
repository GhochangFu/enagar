import { createHash, randomBytes } from 'node:crypto';

/** RFC 7636 code verifier — high-entropy random string. */
export function randomPkceVerifier(): string {
  return base64Url(randomBytes(32));
}

/** S256 challenge derived from verifier. */
export function pkceChallengeS256(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
