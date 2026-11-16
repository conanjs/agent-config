// The three files of a run's result, each read and written through `atomicFiles`: `components.lock`, `install-state.json` and the
// journal `install-state.pending.json`. Reading a file that is damaged or newer than this installer is an expected answer, not a throw.
import path from 'node:path';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import {
  emitComponentsLock,
  parseComponentsLock,
  type ComponentsLock,
  type StateFileProblem,
} from '#state/domain/components/ComponentsLock.ts';
import { emitInstallState, parseInstallState, type InstallState } from '#state/domain/installState/InstallState.ts';
import { emitJournal, parseJournal, type Journal } from '#state/domain/journal/Journal.ts';
import { containIn } from '#state/application/files/containIn.ts';
import { readFileIfPresent, writeFileAtomically, type FileRefusal } from '#state/application/files/atomicFiles.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** File names inside the agent home. */
export const STATE_FILES = {
  lock: 'components.lock',
  state: 'install-state.json',
  journal: 'install-state.pending.json',
} as const;

/** Why a state file cannot be used. */
export type StateFileFailure =
  | { readonly kind: 'refused'; readonly refusal: FileRefusal }
  | { readonly kind: 'invalid'; readonly problem: StateFileProblem };

/** What reading an optional state file gave: nothing yet, or the content. */
export type Loaded<Value> = { readonly present: false } | { readonly present: true; readonly value: Value };

function where(deps: StateDeps, file: string): string {
  return path[deps.flavor].join(deps.home, file);
}

function load<Value>(
  deps: StateDeps,
  file: string,
  parse: (text: string) => Result<Value, StateFileProblem>,
): Result<Loaded<Value>, StateFileFailure> {
  const read = readFileIfPresent(deps, where(deps, file));
  if (!read.ok) return refuse({ kind: 'refused', refusal: read.error });
  if (read.value.kind === 'absent') return succeed({ present: false });
  const parsed = parse(read.value.text);
  return parsed.ok
    ? succeed({ present: true, value: parsed.value })
    : refuse({ kind: 'invalid', problem: parsed.error });
}

function store(deps: StateDeps, file: string, text: string): Result<'written', StateFileFailure> {
  const written = writeFileAtomically(deps, where(deps, file), text);
  return written.ok ? written : refuse({ kind: 'refused', refusal: written.error });
}

/**
 * Loads `components.lock` from the home, if the previous run left one.
 *
 * @param deps - the ports and roots
 * @returns the lock, `present: false` when there is none yet, or why it cannot be used
 */
export function readComponentsLock(deps: StateDeps): Result<Loaded<ComponentsLock>, StateFileFailure> {
  return load(deps, STATE_FILES.lock, parseComponentsLock);
}

/**
 * Writes `components.lock` by temporary file and rename (LK-4).
 *
 * @param deps - the ports and roots
 * @param lock - the lock to write
 * @returns `written`, or why the path was refused
 */
export function writeComponentsLock(deps: StateDeps, lock: ComponentsLock): Result<'written', StateFileFailure> {
  return store(deps, STATE_FILES.lock, emitComponentsLock(lock));
}

/**
 * Reads `install-state.json`; a newer major is refused and never rewritten (DR-205).
 *
 * @param deps - the ports and roots
 * @returns the state, `present: false` when there is none yet, or why it cannot be used
 */
export function readInstallState(deps: StateDeps): Result<Loaded<InstallState>, StateFileFailure> {
  return load(deps, STATE_FILES.state, parseInstallState);
}

/**
 * Writes `install-state.json` by temporary file and rename: this rename is the commit point of a run.
 *
 * @param deps - the ports and roots
 * @param state - the state to write
 * @returns `written`, or why the path was refused
 */
export function writeInstallState(deps: StateDeps, state: InstallState): Result<'written', StateFileFailure> {
  return store(deps, STATE_FILES.state, emitInstallState(state));
}

/**
 * Reads the journal of an interrupted run.
 *
 * @param deps - the ports and roots
 * @returns the journal, `present: false` when there is none, or why it cannot be replayed
 */
export function readJournal(deps: StateDeps): Result<Loaded<Journal>, StateFileFailure> {
  return load(deps, STATE_FILES.journal, (text) => {
    const parsed = parseJournal(text);
    return parsed.ok ? parsed : refuse({ kind: 'corrupt', sentence: parsed.error });
  });
}

/**
 * Writes the journal before the first switch of a run.
 *
 * @param deps - the ports and roots
 * @param journal - the journal to write
 * @returns `written`, or why the path was refused
 */
export function writeJournal(deps: StateDeps, journal: Journal): Result<'written', StateFileFailure> {
  return store(deps, STATE_FILES.journal, emitJournal(journal));
}

/**
 * Deletes the journal, the last step of a commit or of a restore.
 *
 * @param deps - the ports and roots
 * @returns `removed` or `absent`, or why the path was refused
 */
export function removeJournal(deps: StateDeps): Result<'removed' | 'absent', StateFileFailure> {
  const target = where(deps, STATE_FILES.journal);
  const read = readFileIfPresent(deps, target);
  if (!read.ok) return refuse({ kind: 'refused', refusal: read.error });
  if (read.value.kind === 'absent') return succeed('absent');
  const checked = containIn(deps, target, 'keep-link');
  if (!checked.ok) return refuse({ kind: 'refused', refusal: { kind: 'outside', reason: checked.error.reason } });
  deps.fs.remove(checked.value);
  return succeed('removed');
}
