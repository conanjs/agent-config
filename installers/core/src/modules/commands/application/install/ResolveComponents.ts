// Step "resolve" of the pipeline: the pure resolver of the resolution module, fed with the components that were read, the citations
// found in their files and the versions of the programs. The answer is data: what to install in order, what to ask V for, or what fails.
import { renderSkipWarning } from '#manifests/application/messages/renderManifestMessages.ts';
import { renderResolutionError } from '#resolution/application/messages/renderResolutionMessages.ts';
import { resolveInstall } from '#resolution/application/resolveInstall.ts';
import type {
  Candidate,
  CitedPath,
  ComponentNeed,
  Placed,
  ResolutionResult,
  ResolveInput,
} from '#resolution/application/ResolutionTypes.ts';
import type { Notice } from '#commands/application/install/CommandOutput.ts';
import { citationMounts, citationsOf } from '#commands/application/install/CitationScan.ts';
import type { ReadOutcome } from '#commands/application/install/ReadComponents.ts';
import type { CommandsDeps } from '#commands/application/install/InstallTypes.ts';

/** What resolving gave. */
export type ResolveOutcome =
  | { readonly kind: 'resolved'; readonly install: readonly Placed[]; readonly warnings: readonly Notice[] }
  | { readonly kind: 'needs'; readonly needs: readonly ComponentNeed[]; readonly warnings: readonly Notice[] }
  | { readonly kind: 'failed'; readonly errors: readonly Notice[]; readonly warnings: readonly Notice[] };

const GIT_VERSION = /(\d+\.\d+\.\d+)/;

/**
 * Collects the versions of the programs that components may require.
 *
 * @param deps - the Runtime port
 * @returns the node version and, when git runs, its version number
 */
export function runtimeVersions(deps: Pick<CommandsDeps, 'runtime'>): Readonly<Record<string, string>> {
  const git = GIT_VERSION.exec(deps.runtime.gitVersionText() ?? '')?.[1];
  return { node: deps.runtime.nodeVersion(), ...(git === undefined ? {} : { git }) };
}

// Only a component that depends on a slot can cite another component's files (FR-017: `depends.slots[].docs` is generated from its
// citations), so only those are scanned; a self-contained provider is never read file by file (DR-404).
function scanCitations(deps: CommandsDeps, read: ReadOutcome): readonly CitedPath[] {
  const mounts = citationMounts(read.slots);
  const scanned = [
    ...read.loaded.map((one) => ({ name: one.name, root: one.sourceRoot, manifest: one.manifest })),
    ...(read.core === undefined
      ? []
      : [{ name: read.core.manifest.name, root: read.core.root, manifest: read.core.manifest }]),
  ];
  return scanned
    .filter((one) => one.manifest.depends.slots.length > 0)
    .flatMap((one) => citationsOf(one.name, deps.disk.markdownFiles(one.root), mounts));
}

/**
 * Builds what the resolver reads from the components that were read: candidates, agent-config's own manifest, the citations in their
 * files and the versions of the programs.
 *
 * @param deps - the services the commands were given
 * @param read - what the read step gave
 * @returns the resolver's input
 */
export function resolveInputOf(deps: CommandsDeps, read: ReadOutcome): ResolveInput {
  const candidates: Candidate[] = read.loaded.map((one) => ({
    name: one.name,
    origin: one.entry.origin,
    source: one.entry.source,
    manifest: one.manifest,
  }));
  return {
    slots: read.slots,
    candidates,
    core: read.core?.manifest,
    citations: scanCitations(deps, read),
    runtime: runtimeVersions(deps),
  };
}

/**
 * Resolves the components that were read into what to install, what to ask V for, or what fails (FR-022, AC-5.1 to AC-5.9).
 *
 * @param deps - the services the commands were given
 * @param read - what the read step gave
 * @returns the providers-first install order, the slots nothing fills, or the errors in the order of the resolver
 */
export function resolveComponents(deps: CommandsDeps, read: ReadOutcome): ResolveOutcome {
  const result = resolveInstall(resolveInputOf(deps, read));
  return outcomeOf(result);
}

/**
 * Turns the answer of the resolver into the outcome the pipeline works with.
 *
 * @param result - what `resolveInstall` or `settleResolution` gave
 * @returns the install order, the needs, or the errors, each with the warnings for components the resolver left out
 */
export function outcomeOf(result: ResolutionResult): ResolveOutcome {
  const warnings: Notice[] = result.skipped.map((skip) => ({
    severity: 'warning',
    check: 'component-skipped',
    item: skip.name,
    line: renderSkipWarning({ name: skip.name, reason: skip.reason }),
  }));
  if (result.errors.length > 0) {
    const errors: Notice[] = result.errors.map((error) => ({
      severity: 'error',
      check: 'resolution',
      item: error.kind,
      line: renderResolutionError(error),
    }));
    return { kind: 'failed', errors, warnings };
  }
  return result.status === 'needs'
    ? { kind: 'needs', needs: result.needs, warnings }
    : { kind: 'resolved', install: result.install, warnings };
}
