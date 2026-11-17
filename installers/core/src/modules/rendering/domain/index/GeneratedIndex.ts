// The text of `generated/index.md` (AC-16.4, the `index` line of rendered-copy/v1): it explains the mechanism once, so each rendered
// file carries only its one first line. It holds no path of this machine and no clock value, so it is the same text on every machine.

const LINES = [
  '# Generated files',
  '',
  'Everything in this folder is written by the installer on this machine. It is rebuilt on every `install` and `install --update`, and no repository tracks it.',
  '',
  '## What is rendered, and from where',
  '',
  'When a component is rendered, `<component>/` holds a read-only copy of it, with the same relative paths as its source. None is rendered before phase 5 of the repo split, so until then this folder holds only the files listed below.',
  '',
  'A copy differs from its source in three ways only: each cited location is shown as the real path on this machine and links to that file, each agent-home placeholder path in prose is the real path, and its first line is added.',
  '',
  'Today this folder holds:',
  '',
  '- `global-variables.md`, one table of the variables of the enabled components and the values V stored; `AGENT_HOME` is its first row.',
  '- `index.md`, this file.',
  '',
  '## Edit the source, not the copy',
  '',
  'The first line of a rendered copy reads "Generated from `<source path>`; edit that file, not this copy." and names the file in the component to change.',
  'A rendered file is read-only, and the next `install` replaces it. `doctor` reports a copy that differs from a fresh render and names the source to edit.',
];

/**
 * Writes the explanation that agents and people read once, at the top of the generated folder.
 *
 * @returns the file text, ending with one line ending
 */
export function renderGeneratedIndex(): string {
  return `${LINES.join('\n')}\n`;
}
