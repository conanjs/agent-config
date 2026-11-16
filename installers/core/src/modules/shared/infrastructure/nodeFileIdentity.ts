import { statSync } from 'node:fs';
import type { IdentityAnswer } from '#shared/application/containment/PathProbe.ts';

/**
 * Answers `PathProbe.identity` on a real disk: the device and index number of what a path reaches, links followed.
 *
 * @param target - an absolute path
 * @returns the identity; `missing` only for ENOENT and ENOTDIR; `unknown` for every other error, so a check refuses instead of guessing
 */
export function nodeFileIdentity(target: string): IdentityAnswer {
  try {
    const stats = statSync(target, { bigint: true });
    return { kind: 'identity', dev: stats.dev, ino: stats.ino };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'ENOENT' || code === 'ENOTDIR' ? { kind: 'missing' } : { kind: 'unknown' };
  }
}
