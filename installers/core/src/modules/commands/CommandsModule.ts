// The composer of the commands module (MOD-11): it receives every service from the composition root (T142) and returns the commands with
// those services filled in. It imports no adapter. Phase 2 has `install` and `plan` here; doctor, set, add, use, init-component and
// uninstall join it with T139 to T141.
import { runInstall } from '#commands/application/install/RunInstall.ts';
import type { CommandOutput, CommandsDeps, UpdateRequest } from '#commands/application/install/InstallTypes.ts';

/** The commands with their services filled in. */
export interface CommandsApi {
  /**
   * Runs `install`, which applies the plan after V has confirmed the home and approved any privileged change.
   *
   * @param update - which git sources to advance; `none` for a plain install, which stays on the locked commits (M-02)
   * @returns the report and the lines of text mode; the exit code is in the report
   */
  install(update: UpdateRequest): Promise<CommandOutput>;

  /**
   * Runs `plan`, which lists what `install` would change and writes nothing (AC-7.4).
   *
   * @returns the report and the lines of text mode; the exit code is in the report
   */
  plan(): Promise<CommandOutput>;
}

/**
 * Binds the commands to the services of one run.
 *
 * @param deps - what the composition root chose
 * @returns the commands, ready to call
 */
export function composeCommands(deps: CommandsDeps): CommandsApi {
  return {
    install: (update) => runInstall(deps, { command: 'install', update }),
    plan: () => runInstall(deps, { command: 'plan', update: { kind: 'none' } }),
  };
}
