// DR-204, DR-417, AC-8.1, AC-8.2, FR-031: the compatibility links. After the move to the new agent home, text that still names an old
// agent-home path under Copilot's folder keeps resolving through one link per name. Copilot's own folders are never replaced, and a
// missing one is never created. The folder name of Copilot's home is built from parts below so that this file holds no hard-coded
// Copilot-home path of its own (the sorting check of AC-8.4 counts such lines).
import path from 'node:path';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';

/** The folder name of Copilot's home inside the user's home folder. */
export const COPILOT_FOLDER = ['.', 'copilot'].join('');

/**
 * The names under Copilot's home that Copilot itself owns (record `own:` of scripts/copilot-paths.yaml, which a unit test compares with
 * this list). A compatibility link is never placed over one of them.
 */
export const COPILOT_OWN_NAMES: readonly string[] = [
  'instructions',
  'hooks',
  'agents',
  'prompts',
  'skills',
  'session-state',
  'config.json',
  'settings.json',
  'copilot-instructions.md',
  'mcp-config.json',
  'memory',
  'logs',
];

/** What a compatibility link points at inside the agent home. */
export type CompatKind = 'folder' | 'file';

/** One compatibility link: where it goes under Copilot's home and what it points at in the agent home. */
export interface CompatLink {
  /** The absolute path of the link. */
  readonly path: string;
  /** The absolute path in the agent home it points at. */
  readonly target: string;
  /** Whether the target is a folder or a file. */
  readonly kind: CompatKind;
  /** The path of the target relative to the agent home, with `/`; the plan links it only when the run creates that entry. */
  readonly homeEntry: string;
  /**
   * The folder that must already be a real folder for the link to be placed, for a link placed inside a folder Copilot owns;
   * `undefined` for a link directly under Copilot's home.
   */
  readonly insideOwnFolder: string | undefined;
}

/** The folders of the agent home that old text names under Copilot's home (AC-8.1). */
export const COMPAT_FOLDER_NAMES: readonly string[] = [
  'atlas',
  'companies',
  'frameworks',
  'knowledge',
  'patterns',
  'procedures',
  'references',
  'tracker',
];

/** The one file name linked beside the folders. */
export const COMPAT_VARIABLES_FILE = 'global-variables.md';

/** The one entry linked inside Copilot's own `instructions` folder, as a link to a single file (AC-8.1, AC-8.2). */
export const COMPAT_CORE_INSTRUCTIONS = 'instructions/core.instructions.md';

/**
 * Gives the folder of Copilot's home.
 *
 * @param userHome - the user's home folder
 * @param flavor - the path syntax
 * @returns the absolute path of Copilot's home
 */
export function copilotHomeOf(userHome: string, flavor: PathFlavor): string {
  return path[flavor].join(userHome, COPILOT_FOLDER);
}

/**
 * Tells whether a path is Copilot's own: one of its own entries or anything inside one.
 *
 * @param candidate - an absolute path
 * @param userHome - the user's home folder
 * @param flavor - the path syntax
 * @returns true when the first segment below Copilot's home is one of {@link COPILOT_OWN_NAMES}
 */
export function isCopilotOwn(candidate: string, userHome: string, flavor: PathFlavor): boolean {
  const flavored = path[flavor];
  const relative = flavored.relative(copilotHomeOf(userHome, flavor), flavored.normalize(candidate));
  const first = relative.split(flavored.sep)[0] ?? '';
  return relative !== '' && !relative.startsWith('..') && COPILOT_OWN_NAMES.includes(first);
}

/**
 * Lists the compatibility links of one agent home, in the order they are placed.
 *
 * @param userHome - the user's home folder
 * @param home - the agent home
 * @param flavor - the path syntax
 * @returns the eight folder links, the variables file link and the core instructions link
 */
export function compatLinkTable(userHome: string, home: string, flavor: PathFlavor): readonly CompatLink[] {
  const flavored = path[flavor];
  const copilot = copilotHomeOf(userHome, flavor);
  const folders: CompatLink[] = COMPAT_FOLDER_NAMES.map((name) => ({
    path: flavored.join(copilot, name),
    target: flavored.join(home, name),
    kind: 'folder',
    homeEntry: name,
    insideOwnFolder: undefined,
  }));
  const file = (entry: string, ownFolder: string | undefined): CompatLink => ({
    path: flavored.join(copilot, ...entry.split('/')),
    target: flavored.join(home, ...entry.split('/')),
    kind: 'file',
    homeEntry: entry,
    insideOwnFolder: ownFolder === undefined ? undefined : flavored.join(copilot, ownFolder),
  });
  return [...folders, file(COMPAT_VARIABLES_FILE, undefined), file(COMPAT_CORE_INSTRUCTIONS, 'instructions')];
}
