import type { Result } from '#shared/domain/result/Result.ts';
import {
  chooseAgentHome,
  type AgentHomeChoice,
  type AgentHomeRequest,
  type AgentHomeViolation,
} from '#variables/domain/home/AgentHome.ts';

/**
 * Chooses the agent home of a run from `AGENT_CONFIG_HOME`, the recorded home and the user's home folder, refusing a file system
 * root, the user's home folder and a folder that holds it (M-03). An empty `AGENT_CONFIG_HOME` means unset.
 *
 * @param request - the facts the Environment port and `install-state.json` give
 * @returns the home with its source and confirmation, or which input was refused and why
 */
export function chooseHome(request: AgentHomeRequest): Result<AgentHomeChoice, AgentHomeViolation> {
  return chooseAgentHome(request);
}
