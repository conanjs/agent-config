/** The guard's answer to one tool call: leave it alone, or refuse it with a reason the agent is shown. */
export type GuardOutcome =
  { readonly kind: "no-decision" } | { readonly kind: "deny"; readonly reason: string };
