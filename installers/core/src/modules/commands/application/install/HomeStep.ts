// Step "home" of the pipeline (FR-013, AC-2.1 to AC-2.5, AC-4.7, M-03, M-11): which folder is the agent home, and has V confirmed it.
// The recorded home is read from the install state of the default home and of `AGENT_CONFIG_HOME`. A home that is not confirmed is a
// need, alone: nothing else is read or written until V says yes, and only at an interactive terminal (a pipe, a file or an environment
// variable never counts). `plan` never asks; it reports the need.
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { ReportHome } from '#shared/domain/report/InstallReport.ts';
import { chooseHome } from '#variables/application/home/chooseHome.ts';
import type { PublicAgentHomeChoice, PublicAgentHomeViolation } from '#variables/application/VariablesTypes.ts';
import { buildOutput, type Notice } from '#commands/application/install/CommandOutput.ts';
import type {
  CommandOutput,
  CommandsDeps,
  HomeServices,
  InstallRequest,
} from '#commands/application/install/InstallTypes.ts';
import { homeNeed } from '#commands/application/install/NeedBlocks.ts';

/** What the home step decided. */
export type HomeStepResult =
  | { readonly kind: 'go'; readonly home: PublicAgentHomeChoice; readonly services: HomeServices }
  | { readonly kind: 'stop'; readonly output: CommandOutput };

/**
 * Turns the chosen home into the part of a report that shows it, with the recorded home only when the run is a move.
 *
 * @param choice - the chosen home
 * @returns the home as the report shows it, with the recorded home when the run is a move
 */
export function reportHome(choice: PublicAgentHomeChoice): ReportHome {
  return {
    path: choice.path,
    confirmed: choice.confirmed,
    source: choice.source,
    ...(choice.recordedHome === undefined ? {} : { recorded: choice.recordedHome }),
  };
}

const flavorKey = (flavor: 'posix' | 'win32', text: string): string => (flavor === 'win32' ? text.toLowerCase() : text);

function refusedPath(violation: PublicAgentHomeViolation, deps: CommandsDeps): string {
  const { environment } = deps;
  if (violation.input === 'AGENT_CONFIG_HOME') return environment.configuredHome ?? '';
  if (violation.input === 'user-home') return environment.userHome;
  return violation.input === 'default-home' ? 'the default agent home' : 'the recorded agent home';
}

function refusal(request: InstallRequest, deps: CommandsDeps, violation: PublicAgentHomeViolation): CommandOutput {
  const line = renderMessage('MG-41', { path: refusedPath(violation, deps), reason: violation.reason });
  const notice: Notice = { severity: 'error', check: 'home-refused', item: violation.input, line };
  return buildOutput({ command: request.command, status: 'failed', home: null, body: [line], notices: [notice] });
}

function unreadable(request: InstallRequest, home: string, cause: string): CommandOutput {
  const line = renderMessage('MG-38', { what: 'install-state.json cannot be read' });
  const more = [renderMessage('MG-38.cause', { cause })];
  const notice: Notice = { severity: 'error', check: 'state-unreadable', item: home, line, more };
  return buildOutput({
    command: request.command,
    status: 'failed',
    home: null,
    body: [line, ...more],
    notices: [notice],
  });
}

// The home that a run left a state file in: the folder `AGENT_CONFIG_HOME` names and the default folder, in that order. The state
// names its own folder, so a copy of the file in another folder is not taken for a record.
function findRecordedHome(
  deps: CommandsDeps,
  folders: readonly string[],
): { readonly recorded: string | undefined; readonly failure: string | undefined } {
  const flavor = deps.environment.flavor;
  for (const folder of folders) {
    // A folder that is not there has no state; asking the state module would be refused for want of a home to look in.
    if (deps.disk.observe(folder).kind === 'absent') continue;
    const read = deps.forHome(folder).state.readInstallState();
    if (!read.ok) {
      const sentence = read.error.kind === 'invalid' ? read.error.problem.sentence : 'the file is not a regular file';
      return { recorded: undefined, failure: sentence };
    }
    if (read.value.present && flavorKey(flavor, read.value.value.home) === flavorKey(flavor, folder)) {
      return { recorded: read.value.value.home, failure: undefined };
    }
  }
  return { recorded: undefined, failure: undefined };
}

function isYes(answer: string): boolean {
  return answer.trim().toLowerCase() === 'yes';
}

async function confirmed(deps: CommandsDeps, choice: PublicAgentHomeChoice): Promise<boolean> {
  const question =
    choice.recordedHome === undefined
      ? renderMessage('MG-11.home', { home: choice.path })
      : renderMessage('MG-11.move', { oldHome: choice.recordedHome, newHome: choice.path });
  try {
    return isYes(await deps.terminal.ask(question));
  } catch {
    // A terminal that fails to answer is no answer: consent is never assumed (M-11).
    return false;
  }
}

type Chosen =
  | { readonly kind: 'chosen'; readonly choice: PublicAgentHomeChoice; readonly services: HomeServices }
  | { readonly kind: 'stop'; readonly output: CommandOutput };

// The recorded home first, then the home itself checked against the folder on disk (a link to the user's home is refused, M-03).
function chooseVerified(deps: CommandsDeps, request: InstallRequest): Chosen {
  const { environment } = deps;
  const base = { flavor: environment.flavor, userHome: environment.userHome };
  const first = chooseHome({ ...base, configuredHome: environment.configuredHome, recordedHome: undefined });
  if (!first.ok) return { kind: 'stop', output: refusal(request, deps, first.error) };
  const standard = chooseHome({ ...base, configuredHome: undefined, recordedHome: undefined });
  const folders =
    standard.ok && standard.value.path !== first.value.path
      ? [first.value.path, standard.value.path]
      : [first.value.path];
  const found = findRecordedHome(deps, folders);
  if (found.failure !== undefined) {
    return { kind: 'stop', output: unreadable(request, first.value.path, found.failure) };
  }
  const chosen = chooseHome({ ...base, configuredHome: environment.configuredHome, recordedHome: found.recorded });
  if (!chosen.ok) return { kind: 'stop', output: refusal(request, deps, chosen.error) };
  const services = deps.forHome(chosen.value.path);
  const verified = services.variables.verifyHome(chosen.value);
  if (!verified.ok) return { kind: 'stop', output: refusal(request, deps, verified.error) };
  return { kind: 'chosen', choice: chosen.value, services };
}

/**
 * Chooses the agent home of the run and asks V to confirm it when it is not confirmed yet.
 *
 * @param deps - the services the commands were given
 * @param request - the command; only `install` asks, `plan` reports the need
 * @returns the confirmed home with its services, or the finished output of a run that stops here (exit 10 or exit 1)
 */
export async function resolveHome(deps: CommandsDeps, request: InstallRequest): Promise<HomeStepResult> {
  const chosen = chooseVerified(deps, request);
  if (chosen.kind === 'stop') return chosen;
  const { choice, services } = chosen;
  if (choice.confirmed) return { kind: 'go', home: choice, services };
  // Not confirmed: only a person at an interactive terminal can confirm it, and `plan` never asks (M-11).
  const asks = request.command === 'install' && deps.terminal.interactive;
  if (asks && (await confirmed(deps, choice))) return { kind: 'go', home: { ...choice, confirmed: true }, services };
  const home = reportHome(choice);
  const need = homeNeed(home, deps.terminal.interactive);
  return {
    kind: 'stop',
    output: buildOutput({ command: request.command, status: 'needs-input', home, needs: [need] }),
  };
}
