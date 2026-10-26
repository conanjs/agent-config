# Research: revise a document

Decision records for the reference implementation (`decision-record/v2`).

## DR-001: Toolchain and alias mechanism for api

- **Tree path:** TC-Q1 (NO: new repo) → TC-Q2 (NO: no constitution tooling rules) → TC-Q3 (every slot from the stack defaults; stack Option "alias mechanism" shown at the gate)
- **Criteria:** `stacks/typescript-node/index.md` slot defaults; `stacks/typescript-node/idioms.md` Options table (TSN-15).
- **Options considered:** tsconfig `paths` with `@/` and `tsc-alias` | `package.json` `imports` with `#`
- **Chosen:** tsconfig `paths` with `@/` and `tsc-alias` — the stack default; the `@/` form is the common convention (NestJS, Vite, Next.js templates).
- **Rejected:** `package.json` `imports` — needs a `source` condition in tsx, Vitest and the ESLint resolver; no gain for an app that always runs from a build.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** tech-stack · **Approved at:** G1 (2026-10-25)

## PDM-api: Paradigm for api

- **Tree path:** PDM-Q1 (NO: no existing code) → PDM-Q2 (YES: `Document` owns the version invariant) → class-modeled@1
- **Criteria:** `Document.revise` must refuse a stale version on every path; a class with private state keeps that rule in one place.
- **Options considered:** class-modeled@1 | functional-pipeline@1
- **Chosen:** class-modeled@1 — the domain has one entity whose invariant must hold across operations.
- **Rejected:** functional-pipeline@1 — no input-to-output transform dominates; the invariant would move into free functions.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** engineering · **Approved at:** G1 (2026-10-25)
