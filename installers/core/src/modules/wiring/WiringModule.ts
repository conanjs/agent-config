// The composer of the wiring module (MOD-11): it receives the adapters from the composition root (T142) and returns the use cases with
// their ports filled in. It imports no adapter itself.
import { planCompat } from '#wiring/application/compat/planCompat.ts';
import { planRetired } from '#wiring/application/compat/planRetired.ts';
import { readRetiredList } from '#wiring/application/compat/readRetiredList.ts';
import { renderRetired } from '#wiring/application/compat/renderRetired.ts';
import { describePrivileged } from '#wiring/application/privileged/describePrivileged.ts';
import { checkPrivileged } from '#wiring/application/privileged/privilegedSet.ts';
import type { HookFiles } from '#wiring/application/ports/HookFiles.ts';
import type { PathObserver } from '#wiring/application/ports/PathObserver.ts';
import type { YamlReader } from '#wiring/application/ports/YamlReader.ts';
import type { WiringApi } from '#wiring/application/WiringApi.ts';

/** The adapters the module needs. */
export interface WiringPorts {
  /** Looks at paths without following a link at the end. */
  readonly observer: PathObserver;
  /** Reads the agent hook and settings files. */
  readonly hookFiles: HookFiles;
  /** The hardened YAML reader for `compat.yaml`. */
  readonly readYaml: YamlReader;
}

/**
 * Builds the wiring use cases over the given adapters.
 *
 * @param ports - the adapters, chosen by the composition root
 * @returns the use cases, ready to call
 */
export function composeWiring(ports: WiringPorts): WiringApi {
  return {
    planCompat: (request) => planCompat(ports.observer, request),
    readRetiredList: (text, userHome, flavor) => readRetiredList(text, ports.readYaml, userHome, flavor),
    planRetired: (request) => planRetired(ports.observer, ports.hookFiles, request),
    checkPrivileged,
    describePrivileged,
    renderRetired,
  };
}
