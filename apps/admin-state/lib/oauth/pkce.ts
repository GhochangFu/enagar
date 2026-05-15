import { createHash, randomBytes } from 'node:crypto';

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function randomPkceVerifier(): string {
  return base64Url(randomBytes(32));
}

export function pkceChallengeS256(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}
