import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { VariablesFileStore } from '#variables/application/ports/VariablesFileStore.ts';

// One byte over the YAML reader's 256 KiB limit (M-17): enough for the reader to see "too large" without holding a hostile file.
const READ_LIMIT_BYTES = 262_145;

/**
 * Reads `variables.local.yaml` from one absolute path: a regular file only, never a link (O_NOFOLLOW), at most the read limit.
 *
 * @param filePath - where `variables.local.yaml` is, absolute
 * @returns a store that reads that one file
 */
export function fileVariablesFileStore(filePath: string): VariablesFileStore {
  return {
    async readText() {
      try {
        const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          if (!(await handle.stat()).isFile()) return { ok: false, error: { kind: 'unreadable' } };
          const buffer = Buffer.alloc(READ_LIMIT_BYTES);
          const { bytesRead } = await handle.read(buffer, 0, READ_LIMIT_BYTES, 0);
          return { ok: true, value: buffer.toString('utf8', 0, bytesRead) };
        } finally {
          await handle.close();
        }
      } catch (error) {
        // Only "not there" is an answer; every other failure (permission, link, folder) is refused, not guessed (ERR-1).
        return (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? { ok: true, value: undefined }
          : { ok: false, error: { kind: 'unreadable' } };
      }
    },
  };
}
