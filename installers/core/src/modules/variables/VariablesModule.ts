// The composer of the variables module (MOD-11): it receives the adapters from the composition root (T142) and returns the use cases
// with their ports filled in. It imports no adapter itself.
import type { PathProbe } from '#shared/application/containment/PathProbe.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import { verifyHomeOnDisk } from '#variables/application/home/verifyHomeOnDisk.ts';
import { findVariableNeeds, type VariableNeedsRequest } from '#variables/application/needs/findVariableNeeds.ts';
import type { DetectProbe } from '#variables/application/ports/DetectProbe.ts';
import type { VariablesFileStore } from '#variables/application/ports/VariablesFileStore.ts';
import type { YamlReader } from '#variables/application/ports/YamlReader.ts';
import { planSetVariable } from '#variables/application/set/planSetVariable.ts';
import { loadValues } from '#variables/application/values/loadValues.ts';

/** The adapters the module needs. */
export interface VariablesPorts {
  /** Reads V's values file. */
  readonly store: VariablesFileStore;
  /** The hardened YAML reader of contracts/lib, handed in so this module imports no YAML library. */
  readonly readYaml: YamlReader;
  /** Looks at one environment variable and one folder, for detect proposals. */
  readonly detectProbe: DetectProbe;
  /** Answers the real-path questions about the agent home. */
  readonly pathProbe: PathProbe;
  /** The user's home folder: HOME on Mac and Linux, USERPROFILE on Windows. */
  readonly userHome: string;
  /** The path syntax of the machine. */
  readonly flavor: PathFlavor;
}

/** The variables use cases with their ports filled in; the commands and rendering modules (T137, T138, T140) call these. */
export interface VariablesApi {
  /** Reads V's values from `variables.local.yaml`; a missing file is no values. */
  loadValues(): ReturnType<typeof loadValues>;
  /** Lists the required variables with no value, each with the proposal the installer may show (nothing is stored). */
  findNeeds(
    request: Pick<VariableNeedsRequest, 'declared' | 'values' | 'legacyText'>,
  ): ReturnType<typeof findVariableNeeds>;
  /** Decides one `set` argument: the new file text to store, or the refusal. Stores nothing itself. */
  planSet: typeof planSetVariable;
  /** Checks the chosen agent home against the folder on disk, by real path and by file identity. */
  verifyHome(choice: Parameters<typeof verifyHomeOnDisk>[0]): ReturnType<typeof verifyHomeOnDisk>;
}

/**
 * Builds the variables use cases over the given adapters.
 *
 * @param ports - the adapters, chosen by the composition root
 * @returns the use cases, ready to call
 */
export function composeVariables(ports: VariablesPorts): VariablesApi {
  return {
    loadValues: () => loadValues({ store: ports.store, readYaml: ports.readYaml }),
    findNeeds: (request) =>
      findVariableNeeds({ ...request, probe: ports.detectProbe, userHome: ports.userHome, flavor: ports.flavor }),
    planSet: planSetVariable,
    verifyHome: (choice) => verifyHomeOnDisk(choice, ports.userHome, ports.flavor, ports.pathProbe),
  };
}
