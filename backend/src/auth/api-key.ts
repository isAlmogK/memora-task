import { createHash } from 'node:crypto';

/** Keys are stored as SHA-256 digests only; a leaked table doesn't leak usable keys. */
export function hashKey(plaintext: string): Buffer {
  return createHash('sha256').update(plaintext, 'utf8').digest();
}

/**
 * Fixed keys the seed creates, so the frontend and curl work out of the box. Public on
 * purpose (they only exist in a dev database); real keys would be random and shown once.
 */
export const DEV_KEYS = {
  aliceUser: 'dev-alice-user-key',
  aliceDevice: 'dev-alice-kindle-key',
  bobUser: 'dev-bob-user-key',
} as const;
