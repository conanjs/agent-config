// The types the install and plan pipeline passes between its steps: what a command is given, the services it uses, and what it returns.
import type { ManifestsApi } from '#manifests/application/ManifestsApi.ts';
import type { PlannedGeneratedFile } from '#rendering/application/generated/planVariablesFiles.ts';
import type { writeGeneratedFiles } from '#rendering/application/generated/writeGeneratedFiles.ts';
import type { SourcesApi } from '#sources/application/SourcesApi.ts';
import type { StateApi } from '#state/application/StateApi.ts';
import type { Clock } from '#state/application/ports/Clock.ts';
import type { findVariableNeeds, VariableNeedsRequest } from '#variables/application/needs/findVariableNeeds.ts';
import type { verifyHomeOnDisk } from '#variables/application/home/verifyHomeOnDisk.ts';
import type { loadValues } from '#variables/application/values/loadValues.ts';
import type { PublicAgentHomeChoice } from '#variables/application/VariablesTypes.ts';
import type { WiringApi } from '#wiring/application/WiringApi.ts';
import type { DiskReader, Environment, Runtime, Terminal } from '#commands/application/ports/CommandPorts.ts';
import type { InstallReport } from '#shared/domain/report/InstallReport.ts';

/** How `install --update` names what to advance (AC-3.9). */
export type UpdateRequest =
  { readonly kind: 'none' } | { readonly kind: 'all' } | { readonly kind: 'named'; readonly names: readonly string[] };

/** What `install` and `plan` are asked to do; the command line is parsed by the entry (T142), not here. */
export interface InstallRequest {
  /** `install` applies the plan; `plan` stops after it and writes nothing (AC-7.4). */
  readonly command: 'install' | 'plan';
  /** Which git sources `install --update` advances; a plain run and every `plan` use `none`. */
  readonly update: UpdateRequest;
}

/** The variables use cases the pipeline needs, with the home of the run already bound; `composeVariables` builds a larger object that fits. */
export interface VariablesUse {
  /** Reads V's values from `variables.local.yaml`. */
  loadValues(): ReturnType<typeof loadValues>;
  /** Lists the required variables with no value and the proposal for each. */
  findNeeds(
    request: Pick<VariableNeedsRequest, 'declared' | 'values' | 'legacyText'>,
  ): ReturnType<typeof findVariableNeeds>;
  /** Checks the chosen agent home against the folder on disk. */
  verifyHome(choice: PublicAgentHomeChoice): ReturnType<typeof verifyHomeOnDisk>;
}

/** The rendering use case the pipeline needs, with the writer bound to the home; `composeRendering` builds a larger object that fits. */
export interface RenderingUse {
  /** Writes the planned generated files through the atomic writer of the state module. */
  writeGeneratedFiles(plan: readonly PlannedGeneratedFile[]): ReturnType<typeof writeGeneratedFiles>;
}

/** The services that depend on the agent home, which is known only after the run chose it (DR-305, MOD-11). */
export interface HomeServices {
  /** The state use cases over this home. */
  readonly state: StateApi;
  /** The variables use cases over this home. */
  readonly variables: VariablesUse;
  /** The rendering use case over this home. */
  readonly rendering: RenderingUse;
}

/** Everything the commands are given by the composition root. */
export interface CommandsDeps {
  /** Reads and validates lists, slots and manifests. */
  readonly manifests: ManifestsApi;
  /** Acquires `git` and `path` sources. */
  readonly sources: SourcesApi;
  /** Plans compatibility links, the retired list and the privileged set. */
  readonly wiring: WiringApi;
  /** The machine and the run. */
  readonly environment: Environment;
  /** The terminal, or none. */
  readonly terminal: Terminal;
  /** The versions of the programs. */
  readonly runtime: Runtime;
  /** Reads folders and files. */
  readonly disk: DiskReader;
  /** The clock of the run, the same one the state module reads (CA-7). */
  readonly clock: Pick<Clock, 'now'>;
  /**
   * Builds the services of one agent home. Called with a candidate home before one is chosen, to read the recorded state, so it must
   * work for a folder that does not exist yet.
   */
  readonly forHome: (home: string) => HomeServices;
}

/** What a command returns: the report for `--json` and the exit code, and the lines of text mode in print order. */
export interface CommandOutput {
  /** The one report model of the run (DR-305), redacted and escaped. */
  readonly report: InstallReport;
  /** The text mode lines, the home line first, then the status line, then the body (installer-cli.md "Grammar"). Each is already redacted and escaped. */
  readonly text: readonly string[];
}
