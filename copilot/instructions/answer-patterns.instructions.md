---
name: Answer patterns
description: Named response structures (Answer Pattern Library). Pick pattern by tag in the user's prompt, else use default.
applyTo: "**"
---

# Answer Pattern Library (APL)

Detection rule: scan the start of the user's message for `pattern:<name>`
(case-insensitive). If found, strip it and apply that pattern's structure to
the response. If not found, apply the `default` pattern. If an unrecognized
pattern name is given, say so briefly and fall back to `default`.

## default  [used when no tag is given]
Sections:
1. Answer — direct answer first, no preamble.
2. Rationale — why, briefly.
3. Caveats — edge cases, assumptions, risks (omit if none).
4. Next steps — concrete follow-up actions (omit if none).

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

## deepdive  (tag: pattern:deepdive)
Sections:
1. Context — what's relevant and why it matters.
2. Analysis — the substantive reasoning/investigation.
3. Details — supporting specifics, data, code.
4. Sources — references or evidence used, if any.

## quick  (tag: pattern:quick)
One short paragraph. No headers, no sections.
