import fs from 'node:fs';
import path from 'node:path';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import { COPILOT_FOLDER } from '#wiring/domain/compat/CompatLinks.ts';
import type { HookFiles } from '#wiring/application/ports/HookFiles.ts';

const MAX_FILE_BYTES = 1_048_576;
const MAX_FILES = 64;

// The settings and hook files of the three agents, below the user's home; Copilot's hooks folder is listed for its `*.json` files.
function candidates(userHome: string, flavor: PathFlavor): string[] {
  const flavored = path[flavor];
  const copilotHooks = flavored.join(userHome, COPILOT_FOLDER, 'hooks');
  let listed: string[];
  try {
    listed = fs
      .readdirSync(copilotHooks)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .slice(0, MAX_FILES)
      .map((name) => flavored.join(copilotHooks, name));
  } catch {
    // No hooks folder (or one that cannot be listed) simply has no file to read; an unreadable folder is reported below.
    listed = [];
  }
  return [
    flavored.join(userHome, '.claude', 'settings.json'),
    flavored.join(userHome, '.claude', 'settings.local.json'),
    flavored.join(userHome, '.codex', 'hooks.json'),
    flavored.join(userHome, '.codex', 'config.toml'),
    ...listed,
  ];
}

/**
 * The real reader of the agent hook and settings files below a user's home.
 *
 * A file that is there but is not a regular file, is over 1 MiB or cannot be read makes `unreadable` true, so a retired link is kept
 * rather than removed on a guess (M-14). Reads text only.
 *
 * @param userHome - the user's home folder
 * @param flavor - the path syntax
 * @returns the reader
 */
export function nodeHookFiles(userHome: string, flavor: PathFlavor): HookFiles {
  return {
    readAll() {
      const texts: string[] = [];
      let unreadable = false;
      for (const file of candidates(userHome, flavor)) {
        try {
          const found = fs.lstatSync(file);
          if (found.isSymbolicLink() || !found.isFile() || found.size > MAX_FILE_BYTES) unreadable = true;
          else texts.push(fs.readFileSync(file, 'utf8'));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') unreadable = true;
        }
      }
      return { texts, unreadable };
    },
  };
}
