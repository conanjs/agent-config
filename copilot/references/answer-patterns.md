# Answer patterns

Applied when a message starts with `pattern:<name>` (any case). The `default` pattern lives in the core instructions.

## bugfix  (tag: pattern:bugfix)
Sections:
1. Root Cause — most likely cause, stated plainly.
2. Fix — the change to make.
3. Verification Steps — how to confirm the fix works.

## decision  (tag: pattern:decision)
Sections:
1. Context — the constraint/goal driving this decision, if not already obvious from the conversation (omit if none).
2. Options — 2-4 viable choices.
3. Trade-offs — brief pros/cons per option.
4. Recommendation — pick one, with one-line justification.

## deepdive  (tag: pattern:deepdive, or the phrases "deep dive", "thorough", "in detail", "complete flow explanation", "explain all cases")
Treat the reader as having zero prior context. Sections:
1. Context — what's relevant and why it matters.
2. Analysis — the substantive reasoning. When the subject has several named settings, options or parameters, or several actors or sides (client vs. server, producer vs. consumer):
   - define every option or actor individually, with its default and what happens when it is unset;
   - with more than one side, list the cross-side interactions: what a change on one side does to every other side;
   - include one worked example and one step-by-step flow (sequence diagram, numbered timeline or table) through a full pass.
3. Details — edge cases and failure or interaction combinations as a matrix or table, not prose; supporting data and code.
4. Sources — mark which claims were verified against source code or official docs and which are general, unverified knowledge.
Precedent: the gRPC keepalive deep dive in `~/.copilot/knowledge/grpc/stale-connection-keepalive.md`.

## quick  (tag: pattern:quick)
One short paragraph. No headers, no sections.
