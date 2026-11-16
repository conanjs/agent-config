// Which git transports a run may use (M-05, DR-609). The policy is data that the composition root decides: production gives
// `https` and `ssh` and reads no test variable. The contract reader already refuses every other scheme in a list, so here the
// policy can only narrow what a list may name; a wider policy needs the reader to learn the scheme first.

/** A git transport. */
export type GitProtocol = 'https' | 'ssh' | 'file';

/** The transports a run may use. */
export interface GitPolicy {
  /** The schemes a git source address may start with. */
  readonly allowedProtocols: readonly GitProtocol[];
}

/**
 * Tells whether the policy allows the scheme of a source address.
 *
 * @param policy - the transports this run may use
 * @param url - a source address that already passed the contract reader
 * @returns true when the scheme before `://` is in the policy
 */
export function isProtocolAllowed(policy: GitPolicy, url: string): boolean {
  const end = url.indexOf('://');
  const scheme = end === -1 ? '' : url.slice(0, end).toLowerCase();
  return (policy.allowedProtocols as readonly string[]).includes(scheme);
}
