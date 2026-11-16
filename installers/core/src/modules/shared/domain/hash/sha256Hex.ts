import { createHash } from 'node:crypto';

/**
 * Hashes text or bytes with SHA-256, for the content hashes of install-state.json, backups and the approved privileged set.
 *
 * Text is hashed as UTF-8. A string with a lone surrogate is refused with a RangeError: UTF-8 cannot hold it, so two different
 * such strings would otherwise get the same replacement character and the same hash. The result is 64 lower-case hex characters, so two hashes compare as plain strings.
 *
 * @param content - the text or bytes to hash
 * @returns the lower-case hex digest
 * @throws RangeError when the text has a lone surrogate
 */
export function sha256Hex(content: string | Uint8Array): string {
  if (typeof content === 'string' && !content.isWellFormed()) {
    throw new RangeError('sha256Hex: the text is not well-formed Unicode (lone surrogate)');
  }
  return createHash('sha256').update(content).digest('hex');
}
