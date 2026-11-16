import { lstatSync, realpathSync } from 'node:fs';
import type { LinkAnswer, PathProbe, RealPathAnswer } from '#shared/application/containment/PathProbe.ts';
import { nodeFileIdentity } from '#shared/infrastructure/nodeFileIdentity.ts';

const ABSENT = new Set(['ENOENT', 'ENOTDIR']);

function codeOf(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

/**
 * The real `PathProbe`: `realpathSync.native` for canonical paths (the one that gives the canonical spelling on a case-insensitive
 * volume), `lstatSync` for links and `statSync` with bigint for identity. Only ENOENT and ENOTDIR mean "not there"; every other
 * error is `unknown`, so a check refuses instead of guessing.
 */
export const nodePathProbe: PathProbe = {
  identity: nodeFileIdentity,
  realPath(target: string): RealPathAnswer {
    try {
      return { kind: 'real', path: realpathSync.native(target) };
    } catch (error) {
      return ABSENT.has(codeOf(error) ?? '') ? { kind: 'missing' } : { kind: 'unknown' };
    }
  },
  isLink(target: string): LinkAnswer {
    try {
      return lstatSync(target).isSymbolicLink() ? 'link' : 'not-link';
    } catch (error) {
      return ABSENT.has(codeOf(error) ?? '') ? 'not-link' : 'unknown';
    }
  },
};
