---
schema: schema/v1
last-updated: 2026-10-04
---

# Schema: Decision Record (`decision-record/v2`)

**Applies to:** records inside `specs/<feature>/research.md`, or §5 of a Company KB `cross-repo-feature` doc (ids `SDR-<nnn>`) · **Store:** D (C for cross-repo) · **Written by:** the deciding role in `decide` mode · **Read by:** every role as ③; `docs/architecture.md` §8 links here · **Loaded as:** ③

Every decision-tree walk ends in one record. Records are never edited after their gate. A changed decision is a new record that says what it supersedes.

## Required structure

```markdown
## <id>: <decision topic>
- **Tree path:** <node (answer) → node (answer) → outcome>
- **Criteria:** <facts that drove the answers, with sources>
- **Options considered:** <A> | <B> | <C>
- **Chosen:** <option> — <one-line reason>
- **Rejected:** <option> — <reason>; <option> — <reason>
- **Confidence:** high | medium | low
- **Supersedes:** <id | none>
- **Decided by:** <role id | human> · **Approved at:** <gate> (<YYYY-MM-DD>)
```

`<id>` is `DR-<nnn>`, `SDR-<nnn>` for system-level decisions in a cross-repo feature doc, or `PDM-<component>` for paradigm decisions (one current record per component; later changes are `PDM-<component>-2`, …).

## Fix log section

```markdown
## Fix log
- <YYYY-MM-DD> · <commit sha> · restores <spec path> <AC id> · root cause: <one line>
```

## Rules

- `Rejected` is mandatory and names at least one alternative.
- A human override of a `security` block is recorded with `Decided by: human`.
- A constitution style deviation that relaxes a blocker rule needs a record.

## Checks

| Check | Tool |
|---|---|
| Every field present; `Rejected` non-empty; ids unique; supersede targets exist | `validate-project.mjs` |

## Changes from v1

- New `PDM-<component>` id form. Field labels are bold, so they parse the same as other records.
