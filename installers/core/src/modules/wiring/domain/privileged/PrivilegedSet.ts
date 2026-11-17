// M-01, M-11, M-14, T-01, T-10: the privileged set. A hook, a route and a service each run or steer an agent with V's full rights, so a new
// or changed one is shown to V in full and applied only after V approves it at an interactive terminal. This file computes the set from
// the components that will be installed and diffs it against what V approved. Pure; the prompt and the file writes belong to T138.
//
// A text that `needsRedaction` would change is REFUSED, never shown with its secret hidden (V must not approve a line that is not the
// line that will run), and so is a text with a control, bidi or invisible character, any character outside printable ASCII in a
// command, argument, matcher or id (a Cyrillic lookalike in a host name, a braille blank, a combining overlay), and a hook command
// that names a compatibility path (M-14: a merged hook command uses the real home path). The approved set is stored as a hash over
// canonical JSON.
//
// WHEN AN UPDATE ASKS AGAIN. The hash of a hook or service from a git source includes the component's commit, so any update of a
// component that has such an entry asks V again: an unchanged command can run different code after an update. A route does not (its
// text decides the entry, and a changed file is ordinary document content, AR-2). For a path source, V's own folder, the command text
// alone is hashed: the code behind it changes with every edit V makes, and asking each time would make V approve by habit. That is the
// accepted risk DR-611.
import { canonicalJson } from '#shared/domain/hash/canonicalJson.ts';
import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';
import { escapeUnsafeText } from '#shared/domain/redaction/escapeUnsafeText.ts';
import { needsRedaction } from '#shared/domain/redaction/redact.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { textNamesPath } from '#wiring/domain/compat/HookUsage.ts';

/** The agents a hook applies to when its manifest names none. */
export const ALL_AGENTS: readonly string[] = ['claude-code', 'copilot-cli', 'codex'];

/** The entries of a manifest that are privileged, as the wiring module reads them (a subset of the manifest). */
export interface PrivilegedSource {
  /** The component id. */
  readonly name: string;
  /** The commit it is installed at, or `live` for a path source. */
  readonly commit: string;
  /** Where the component comes from: a git source (its commit is part of the hash of a hook or service) or a path source (DR-611). */
  readonly origin: 'git' | 'path';
  /** Its hooks. */
  readonly hooks: readonly {
    readonly id: string;
    readonly event: string;
    readonly agents: readonly string[];
    readonly command: string;
    readonly matcher: string | null | undefined;
  }[];
  /** Its routes. */
  readonly routes: readonly {
    readonly id: string;
    readonly when: string;
    readonly read: string;
    readonly beforeWriting: string | undefined;
  }[];
  /** Its services. */
  readonly services: readonly {
    readonly kind: string;
    readonly name: string;
    readonly command: string;
    readonly args: readonly string[];
  }[];
}

/** One entry of the set, with what V sees and the hash of what would run. */
export interface PrivilegedEntry {
  /** `hook`, `route` or `service`. */
  readonly kind: 'hook' | 'route' | 'service';
  /** The key of the entry: kind, component and id, which is also what the install state records. */
  readonly key: string;
  /** The owning component. */
  readonly component: string;
  /** The commit or `live`, shown beside the entry and not part of its hash (an update that changes nothing asks nothing). */
  readonly commit: string;
  /** The SHA-256 of the canonical text of everything that decides what runs. */
  readonly hash: string;
  /** The values of the message of the entry (MG-09). */
  readonly display: PrivilegedDisplay;
}

/** What the need shows for one entry, so the presenter fills the catalogue rows MG-09 without reading the manifest again. */
export type PrivilegedDisplay =
  | {
      readonly kind: 'hook';
      readonly id: string;
      readonly agents: readonly string[];
      readonly event: string;
      readonly command: string;
      readonly matcher: string | null;
    }
  | {
      readonly kind: 'route';
      readonly id: string;
      readonly when: string;
      readonly read: string;
      readonly beforeWriting: string | null;
    }
  | {
      readonly kind: 'service';
      readonly name: string;
      readonly serviceKind: string;
      readonly command: string;
      readonly args: readonly string[];
    };

/** Why a component cannot be installed with this entry. The sentence never repeats the text. */
export interface PrivilegedRefusal {
  /** The owning component. */
  readonly component: string;
  /** The key of the entry. */
  readonly key: string;
  /** `credential-like`: the text would be redacted. `unsafe-characters`: a control or invisible character. `non-ascii`: a character outside printable ASCII where a lookalike could hide. `compat-path`: a hook command names a compatibility path. `duplicate`: the key appears twice. */
  readonly reason: 'credential-like' | 'unsafe-characters' | 'non-ascii' | 'compat-path' | 'duplicate';
  /** One sentence for MG-38, naming the component and no part of the text. */
  readonly sentence: string;
}

/** What `computePrivilegedSet` needs besides the components. */
export interface PrivilegedContext {
  /** The compatibility link paths (a hook command must not name one). */
  readonly compatPaths: readonly string[];
}

// The texts where a lookalike character would hide what runs: ids, commands, arguments, matchers and the paths of a route. Prose (`when`)
// may use any letters; control characters in it are refused by the check above.
function asciiOnlyTexts(display: PrivilegedDisplay): string[] {
  if (display.kind === 'hook') return [display.id, display.event, display.command, display.matcher ?? ''];
  if (display.kind === 'service') return [display.name, display.serviceKind, display.command, ...display.args];
  return [display.id, display.read, display.beforeWriting ?? ''];
}

function textsOf(display: PrivilegedDisplay): string[] {
  if (display.kind === 'hook')
    return [display.id, display.event, ...display.agents, display.command, display.matcher ?? ''];
  if (display.kind === 'route') return [display.id, display.when, display.read, display.beforeWriting ?? ''];
  return [display.name, display.serviceKind, display.command, ...display.args];
}

function hashOf(source: PrivilegedSource, display: PrivilegedDisplay): string {
  // Anything but an explicit path source gets the stricter rule, so an origin left unset by mistake still hashes the commit.
  const fromGit = source.origin !== 'path' && display.kind !== 'route';
  return sha256Hex(
    canonicalJson({ component: source.name, ...display, ...(fromGit ? { commit: source.commit } : {}) }),
  );
}

function keyOf(component: string, display: PrivilegedDisplay): string {
  return `${display.kind}:${component}:${display.kind === 'service' ? display.name : display.id}`;
}

function refusalFor(
  component: string,
  key: string,
  display: PrivilegedDisplay,
  context: PrivilegedContext,
): PrivilegedRefusal | undefined {
  const texts = textsOf(display);
  const refusal = (reason: PrivilegedRefusal['reason'], what: string): PrivilegedRefusal => ({
    component,
    key,
    reason,
    sentence: `component ${component} has ${what} in a privileged entry`,
  });
  if (texts.some((text) => needsRedaction(text))) return refusal('credential-like', 'credential-like text');
  if (texts.some((text) => escapeUnsafeText(text) !== text || !text.isWellFormed())) {
    return refusal('unsafe-characters', 'a control, line-break or invisible character');
  }
  if (asciiOnlyTexts(display).some((text) => !/^[\x20-\x7e]*$/.test(text))) {
    return refusal('non-ascii', 'a character outside printable ASCII');
  }
  if (display.kind === 'hook' && context.compatPaths.some((link) => textNamesPath(display.command, link))) {
    return refusal('compat-path', 'a hook command that names a compatibility path (use the agent home)');
  }
  return undefined;
}

function entriesOf(source: PrivilegedSource): PrivilegedDisplay[] {
  return [
    ...source.hooks.map((hook): PrivilegedDisplay => ({
      kind: 'hook',
      id: hook.id,
      agents: hook.agents.length === 0 ? ALL_AGENTS : [...hook.agents].sort(),
      event: hook.event,
      command: hook.command,
      matcher: hook.matcher ?? null,
    })),
    ...source.routes.map((route): PrivilegedDisplay => ({
      kind: 'route',
      id: route.id,
      when: route.when,
      read: route.read,
      beforeWriting: route.beforeWriting ?? null,
    })),
    ...source.services.map((service): PrivilegedDisplay => ({
      kind: 'service',
      name: service.name,
      serviceKind: service.kind,
      command: service.command,
      args: service.args,
    })),
  ];
}

/**
 * Computes the privileged set of the components that will be installed: every hook, route and service, each checked and hashed.
 *
 * The set is sorted by key, so the same components always give the same set and the same hash.
 *
 * @param sources - the components to install with their commits
 * @param context - the compatibility paths, the user's home and the path syntax
 * @returns the entries, or every refusal (an entry that would have to be shown redacted or altered is never shown)
 */
export function computePrivilegedSet(
  sources: readonly PrivilegedSource[],
  context: PrivilegedContext,
): Result<readonly PrivilegedEntry[], readonly PrivilegedRefusal[]> {
  const entries: PrivilegedEntry[] = [];
  const refusals: PrivilegedRefusal[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const display of entriesOf(source)) {
      const key = keyOf(source.name, display);
      const problem = seen.has(key)
        ? ({
            component: source.name,
            key,
            reason: 'duplicate',
            sentence: `component ${source.name} has two privileged entries with one id`,
          } as const)
        : refusalFor(source.name, key, display, context);
      seen.add(key);
      if (problem !== undefined) refusals.push(problem);
      else
        entries.push({
          kind: display.kind,
          key,
          component: source.name,
          commit: source.commit,
          hash: hashOf(source, display),
          display,
        });
    }
  }
  const sorted = [...entries].sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  return refusals.length === 0 ? succeed(sorted) : refuse(refusals);
}

/**
 * Hashes a privileged set: the SHA-256 of the canonical list of (key, hash) pairs.
 *
 * @param entries - the set from {@link computePrivilegedSet}
 * @returns 64 lower-case hex characters, stored as `approved_privileged_hash` once V approves
 */
export function privilegedSetHash(entries: readonly PrivilegedEntry[]): string {
  return sha256Hex(canonicalJson(entries.map((entry) => [entry.key, entry.hash])));
}

/** What the install state records for one approved entry. */
export interface ApprovedRecord {
  /** `privileged:<kind>:<component>:<id>`, the key of the entry with the prefix the state uses. */
  readonly path: string;
  /** The hash of the entry that V approved. */
  readonly hash: string | undefined;
}

/** The install state path of an entry. */
export const PRIVILEGED_PATH_PREFIX = 'privileged:';

/**
 * Gives the path under which the install state records an approved entry.
 *
 * @param entry - an entry of the set
 * @returns `privileged:` and the key
 */
export function statePathOf(entry: PrivilegedEntry): string {
  return `${PRIVILEGED_PATH_PREFIX}${entry.key}`;
}

/** The difference between the set the install computes and what V approved. */
export interface PrivilegedDiff {
  /** Entries that are new (no approved record) or changed (another hash): V must approve these. Sorted by key. */
  readonly pending: readonly { readonly entry: PrivilegedEntry; readonly change: 'new' | 'changed' }[];
  /** Keys of approved entries that are no longer in the set; removing an entry needs no consent. */
  readonly removed: readonly string[];
}

/**
 * Diffs the computed set against the entries the install state recorded when V approved.
 *
 * @param entries - the set the install computed
 * @param approved - the install-state entries whose path starts with `privileged:` (path and hash)
 * @returns what is new or changed (needs consent) and what disappeared (does not)
 */
export function diffPrivileged(
  entries: readonly PrivilegedEntry[],
  approved: readonly ApprovedRecord[],
): PrivilegedDiff {
  const known = new Map(approved.map((record) => [record.path, record.hash]));
  const pending: { entry: PrivilegedEntry; change: 'new' | 'changed' }[] = [];
  for (const entry of entries) {
    const key = statePathOf(entry);
    if (!known.has(key)) pending.push({ entry, change: 'new' });
    else if (known.get(key) !== entry.hash) pending.push({ entry, change: 'changed' });
  }
  const current = new Set(entries.map(statePathOf));
  const removed = approved
    .map((record) => record.path)
    .filter((recordPath) => !current.has(recordPath))
    .sort();
  return { pending, removed };
}
