# Feature Specification: Fix the four knowledge-validator findings

**Feature Branch**: `feat/spec-kit-validator-tests`

**Created**: 2026-10-29

**Status**: Approved (V: "Fix all of them", 2026-10-29)

**Input**: Findings F-1 to F-4 from `specs/001-knowledge-validator-tests/research.md`: behavior that the 001 scenarios pinned as it was, but that looked wrong.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every printed code is a written rule (Priority: P1)

A reader sees a line such as `KD-9  demo/concept.md: write "1 claim" and "0 claims"`, searches the knowledge schemas for `KD-9`, and finds the rule that line enforces.

**Why this priority**: This is the traceability gap the testing work set out to close (F-3). Without it, a failure cannot be traced back to its requirement.

**Independent Test**: For each code the validator can print, find a `| <code> |` rule row in `copilot/frameworks/knowledge/schemas/*.md`. A test does this automatically.

**Acceptance Scenarios**:

1. **Given** a doc whose Verification status says `1 claims`, **When** the validator runs, **Then** it fails with `KD-9  demo/concept.md: write "1 claim" and "0 claims"` (was `VS`).
2. **Given** a doc with front-matter key `owner`, **When** the validator runs, **Then** it fails with `KB-10  demo/concept.md: front-matter key "owner" is not defined by knowledge-doc/v1 (…)` (was `FM-KEYS`).
3. **Given** a topic index whose Docs Status says `draft` for a verified doc, **When** the validator runs, **Then** it fails with `TI-5  demo/index.md: concept.md Status "draft" ≠ "verified"` (was `IDX`).
4. **Given** the validator prints a code with no rule row in any knowledge schema, **When** the tests run, **Then** they fail and name that code.

---

### User Story 2 - One clear message for a subtopic that nests too deep (Priority: P2)

An author creates `knowledge/demo/sub/deeper/` under a subtopic and gets one instruction, not two that contradict each other (F-1).

**Independent Test**: Run the validator on a subtopic with a subfolder and count the lines about it.

**Acceptance Scenarios**:

1. **Given** subtopic `demo/sub` with a folder `deeper`, **When** the validator runs, **Then** it fails with exactly one line: `TI-6  demo/sub/index.md: subfolders nest at most one level deep`.
2. **Given** topic `demo` with an unlisted folder `extra`, **When** the validator runs, **Then** it still fails with `TI-6  demo/index.md: subfolder "extra" not listed in Subtopics`.

---

### User Story 3 - Repeated paragraphs are found wherever they sit (Priority: P3)

A paragraph that appears twice in one doc is reported even when one copy sits directly under its heading with no blank line (F-2).

**Acceptance Scenarios**:

1. **Given** a deep dive whose body is `## Body` followed directly by paragraph X, a blank line, and X again, **When** the validator runs, **Then** it warns `KB-8  demo/deep-dive.md: paragraph repeated: "…"`.
2. **Given** a heading followed by one paragraph, **When** the validator runs, **Then** the heading text is not part of the compared paragraph.

---

### User Story 4 - Quoted check marks are not counted as claims (Priority: P3)

A doc that quotes ✅ inside a code block keeps a correct claim count (F-4).

**Acceptance Scenarios**:

1. **Given** a concept doc with 1 ✅ claim and a code block containing `ok ✅`, and a status line saying 1 claim, **When** the validator runs, **Then** it passes with no warnings.
2. **Given** a concept doc with `⚠️ unverified` only inside a code block and status `verified`, **When** the validator runs, **Then** neither KD-2 nor KD-9 reports it.

### Edge Cases

- Real docs in `copilot/knowledge/` may hit the corrected checks for the first time (a repeated paragraph under a heading, a fenced ✅). Each such hit is fixed in the doc in this feature, or listed if it cannot be.
- Text outside the validator that names the old codes (schemas, procedures, patterns) is updated. Quotes of past output keep the old code and say it was renamed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every code the validator prints MUST be the id of a rule row in `copilot/frameworks/knowledge/schemas/`.
- **FR-002**: `VS` MUST become `KD-9`; `FM`, `FM-KEYS`, `HEAD`, `REF` MUST become `KB-9`, `KB-10`, `KB-11`, `KB-12`; `IDX` MUST become `TI-1` … `TI-7`, one per topic-index rule.
- **FR-003**: Message text after the code MUST stay the same, so only the code changes in each existing scenario.
- **FR-004**: A subtopic with subfolders MUST get the nesting failure only.
- **FR-005**: The repeated-paragraph check MUST drop heading lines before splitting text into paragraphs.
- **FR-006**: The claim count MUST ignore ✅ and `⚠️ unverified` inside fenced code blocks.
- **FR-007**: A test MUST fail when a printed code has no rule row in the knowledge schemas.

## Success Criteria *(mandatory)*

- **SC-001**: The tests pass, and the only scenarios edited are the ones whose behavior this spec changes.
- **SC-002**: Switching off any single `fail`/`warn` call still makes a scenario fail.
- **SC-003**: `scripts/check-docs.sh` passes on the real knowledge base after the change.

## Assumptions

- Codes are renamed in place with no alias for the old ones: they appear only in output, never in config.
- The rule text for the new rows describes what the validator already checks; it adds no new check.
