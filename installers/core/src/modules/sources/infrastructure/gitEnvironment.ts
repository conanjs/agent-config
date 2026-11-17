// The environment every git call gets (M-05, M-07): built from nothing, not inherited whole, so a variable of the caller's shell
// (GIT_SSH_COMMAND, GIT_EXEC_PATH, GIT_PROXY_COMMAND, GIT_EXTERNAL_DIFF...) cannot change what git runs. What is passed on is what git
// needs to find its program and the user's credential helper or ssh-agent. The GIT_CONFIG_* family is NOT passed on, because
// GIT_CONFIG_COUNT, GIT_CONFIG_KEY_n and GIT_CONFIG_VALUE_n can set any option (core.sshCommand, core.fsmonitor, a pager) and
// GIT_CONFIG_GLOBAL and GIT_CONFIG_SYSTEM can point git at a file of someone else's; a test that needs them gives them as `extra`.

/** Names that are passed on as they are. */
const PASSED = new Set([
  'PATH',
  'HOME',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'SystemRoot',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'TMPDIR',
  'LANG',
  'SSH_AUTH_SOCK',
  'SSH_AGENT_PID',
  'APPDATA',
  'LOCALAPPDATA',
  'XDG_CONFIG_HOME',
]);

/** The only names `extra` may add: the test entry's `url.<x>.insteadOf` mapping needs no more (M-05, DR-609). */
const EXTRA_NAME = /^GIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+)$/;

/** The schemes `GIT_ALLOW_PROTOCOL` can name. */
export interface ProtocolPolicy {
  /** The transports git may use. */
  readonly allowedProtocols: readonly string[];
}

/**
 * Makes the environment for one git call from the process environment and the policy of the run.
 *
 * `GIT_ALLOW_PROTOCOL` comes from the policy and nowhere else, `GIT_TERMINAL_PROMPT=0` stops git from asking for a password (the
 * adapter has no terminal), and `LC_ALL=C` keeps git's messages in English so a network failure can be told from a missing repository.
 *
 * @param base - the environment of this process, read by the composition root and passed in
 * @param policy - the transports this run may use (DR-609)
 * @param extra - names the test entry adds on purpose (the `GIT_CONFIG_*` mapping of its scenario world); production gives none. Any other
 *   name throws, so the seam cannot bring back GIT_SSH_COMMAND or GIT_CONFIG_GLOBAL. They
 *   come before the fixed names below, so they can never change the policy, the prompt, the language or the git-lfs setting
 * @returns a fresh environment with only the names above
 */
export function buildGitEnvironment(
  base: Readonly<Record<string, string | undefined>>,
  policy: ProtocolPolicy,
  extra: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const refused = Object.keys(extra).filter((name) => !EXTRA_NAME.test(name));
  if (refused.length > 0)
    throw new Error(`git environment: only GIT_CONFIG_COUNT, _KEY_n and _VALUE_n may be added: ${refused.join(', ')}`);
  const passed = Object.entries(base).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && PASSED.has(entry[0]),
  );
  return {
    ...Object.fromEntries(passed),
    ...extra,
    GIT_ALLOW_PROTOCOL: policy.allowedProtocols.join(':'),
    GIT_TERMINAL_PROMPT: '0',
    LC_ALL: 'C',
    GIT_LFS_SKIP_SMUDGE: '1',
  };
}
