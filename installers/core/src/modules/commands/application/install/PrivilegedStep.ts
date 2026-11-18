// Step "consent" of the pipeline (M-01, M-11, AC-4.6): the privileged set of the components that will be installed (every hook, route
// and service) is computed by the wiring module and diffed against what V approved, as recorded in `install-state.json`. A new or
// changed entry is a need; an entry that would have to be shown redacted or altered is refused, never shown. Approval records the hash
// of each approved entry, so the same set never needs a second approval.
import type { ComponentManifest } from '#manifests/application/ManifestTypes.ts';
import type { Placed } from '#resolution/application/ResolutionTypes.ts';
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { StateInstallState } from '#state/application/StateTypes.ts';
import type { ConsentCheck } from '#wiring/application/privileged/privilegedSet.ts';
import type { WiringApprovedRecord, WiringPrivilegedSource } from '#wiring/application/WiringTypes.ts';
import type { Notice } from '#commands/application/install/CommandOutput.ts';
import type { CommandsDeps } from '#commands/application/install/InstallTypes.ts';
import type { LoadedComponent } from '#commands/application/install/ReadComponents.ts';

/** The prefix of the install-state path under which an approved entry is recorded. */
export const APPROVAL_PREFIX = 'privileged:';

/** What the consent step found. */
export type ConsentOutcome =
  | { readonly kind: 'refused'; readonly errors: readonly Notice[] }
  | { readonly kind: 'checked'; readonly check: ConsentCheck };

/**
 * Gives the commit a component is installed at: the commit of a git source, or `live` for a path source and for agent-config itself.
 *
 * @param placed - a component to install
 * @param loaded - the components that were read, with their acquired git sources
 * @returns the 40 hex characters, or `live`
 */
export function commitOf(placed: Placed, loaded: readonly LoadedComponent[]): string {
  return loaded.find((one) => one.name === placed.name)?.git?.commit ?? 'live';
}

function sourceOf(placed: Placed, manifest: ComponentManifest, commit: string): WiringPrivilegedSource {
  return {
    name: placed.name,
    commit,
    // A path source is V's own folder: its entries are hashed by their text only (DR-611); anything else hashes the commit too.
    origin: placed.source?.type === 'git' ? 'git' : 'path',
    hooks: manifest.hooks,
    routes: manifest.routes,
    services: manifest.provides.services,
  };
}

/**
 * Reads the approvals out of the last install state.
 *
 * @param state - the state of the last run, if there is one
 * @returns the approved entries with their hashes
 */
export function approvedRecords(state: StateInstallState | undefined): readonly WiringApprovedRecord[] {
  return (state?.entries ?? [])
    .filter((entry) => entry.path.startsWith(APPROVAL_PREFIX))
    .map((entry) => ({ path: entry.path, hash: entry.hash }));
}

/**
 * Computes the privileged set of the run and what in it V has not approved.
 *
 * @param deps - the services the commands were given
 * @param install - the components to install, core included
 * @param loaded - the components that were read, for their commits
 * @param state - the install state of the last run
 * @param home - the agent home
 * @returns the set with its hash and diff, or the errors that stop the run before any need is shown
 */
export function checkConsent(
  deps: CommandsDeps,
  install: readonly Placed[],
  loaded: readonly LoadedComponent[],
  state: StateInstallState | undefined,
  home: string,
): ConsentOutcome {
  const result = deps.wiring.checkPrivileged({
    sources: install.map((placed) => sourceOf(placed, placed.manifest, commitOf(placed, loaded))),
    approved: approvedRecords(state),
    userHome: deps.environment.userHome,
    home,
    flavor: deps.environment.flavor,
  });
  if (result.ok) return { kind: 'checked', check: result.value };
  const errors = result.error.map((refusal): Notice => ({
    severity: 'error',
    check: 'privileged-refused',
    item: refusal.component,
    line: renderMessage('MG-38', { what: refusal.sentence }),
  }));
  return { kind: 'refused', errors };
}
