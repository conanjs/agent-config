import fs from 'node:fs';
import type { Links } from '#state/application/ports/Links.ts';

let counter = 0;

/**
 * The real links for the state module. `switchLink` makes a temporary link beside the old one and renames it over the old one, which
 * replaces a link to a folder in one step (tested on macOS 2026-11-13, DR-202); it is not available on Windows, where the application
 * removes and creates instead. A junction needs an absolute target and a folder.
 */
export const nodeLinks: Links = {
  createLink(path, target, kind) {
    fs.symlinkSync(target, path, kind === 'junction' ? 'junction' : undefined);
  },
  removeLink(path) {
    if (!fs.lstatSync(path).isSymbolicLink()) throw new Error('removeLink: the path is not a link');
    fs.unlinkSync(path);
  },
  switchLink(path, target, kind) {
    if (process.platform === 'win32') throw new Error('switchLink: no atomic switch on Windows');
    counter += 1;
    const temporary = `${path}.switch-${process.pid}-${counter}`;
    fs.symlinkSync(target, temporary, kind === 'junction' ? 'junction' : undefined);
    try {
      fs.renameSync(temporary, path);
    } catch (error) {
      fs.unlinkSync(temporary);
      throw error;
    }
  },
  readLink(path) {
    return fs.readlinkSync(path);
  },
};
