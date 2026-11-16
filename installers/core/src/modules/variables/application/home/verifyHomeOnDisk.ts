// M-03: the text rules of `checkHomeFolder` cannot see a link. A default home `~/.agent-config` that is a link to `/` or to the user's
// home passes them, so the canonical path is checked by the same rules before anything is written there.
import { checkHomeIdentity } from '#shared/application/containment/homeIdentity.ts';
import type { PathProbe } from '#shared/application/containment/PathProbe.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { checkHomeFolder, type AgentHomeChoice, type AgentHomeViolation } from '#variables/domain/home/AgentHome.ts';

const INPUT_OF = {
  default: 'default-home',
  AGENT_CONFIG_HOME: 'AGENT_CONFIG_HOME',
  recorded: 'recorded-home',
} as const;

/**
 * Checks the canonical path of a chosen home against the folder rules, for the home as it is on disk now.
 *
 * A home that does not exist yet is accepted (the first install creates it); the caller must run this again right after creating the
 * folder and before the first write (see `homeIdentity.ts`). A home whose real path cannot be read is refused,
 * because guessing it is fine would let a link to the user's home through.
 *
 * @param choice - the home `chooseAgentHome` returned
 * @param userHome - the user's home folder as the Environment port gives it
 * @param flavor - the path syntax
 * @param probe - the real-path questions of the disk
 * @returns the same choice, or which input is refused and why
 */
export function verifyHomeOnDisk(
  choice: AgentHomeChoice,
  userHome: string,
  flavor: PathFlavor,
  probe: PathProbe,
): Result<AgentHomeChoice, AgentHomeViolation> {
  const input = INPUT_OF[choice.source];
  const real = probe.realPath(choice.path);
  if (real.kind === 'unknown') return refuse({ input, reason: 'the folder cannot be checked, so it is not used' });
  // The identity check also covers a second path to the user's home (a firmlink or bind mount) that no text rule can see.
  const identity = checkHomeIdentity(choice.path, userHome, flavor, probe);
  if (!identity.ok) return refuse({ input, reason: identity.error });
  if (real.kind === 'missing') return succeed(choice);
  // The user's home may itself sit behind a link, so the canonical path is also compared with the canonical home.
  const realUser = probe.realPath(userHome);
  for (const home of realUser.kind === 'real' ? [userHome, realUser.path] : [userHome]) {
    const checked = checkHomeFolder(real.path, home, flavor);
    if (!checked.ok) return refuse({ input, reason: `its real folder is not usable: ${checked.error}` });
  }
  return succeed(choice);
}
