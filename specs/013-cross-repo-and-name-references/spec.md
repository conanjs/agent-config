# Feature Specification: References across repos, and by name

**Feature Branch**: `feat/mod-11-and-coordinator`

**Created**: 2026-10-30

**Status**: Implemented 2026-10-30

**Input**: V, on the two gaps spec 012 left out of scope ("references across repos are not followed"; "a mention without a file extension is not found"): "Do it then."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A reference from another repo is found (Priority: P1)

agent-config's stack pin file links into the reference repo, and the reference repo links back to agent-config. `--explain` looked only inside the explained file's own repo, so neither direction showed.

**Acceptance Scenarios**:

1. **Given** a file linking `<repo web>/blob/<any ref>/<path>`, **When** `--explain` runs on that file of the other repo, **Then** "linked from (direct)" lists the citing file as `<repo>:<path>`, and a declared edge makes it a chain.
2. **Given** the installed form `{{AGENT_HOME}}/…` in another repo's file, **Then** it counts as a path in the home repo.
3. **Given** a repo with a `web` field, **Then** links to that web home count. Without `web`, `url` less its `/blob/<ref>` is used.
4. **Given** a kind with `cites: <repo>`, **Then** its files' repo-relative paths and names are looked up in that repo first. A `cites` that names no repo fails AT-6.
5. **Given** a ref-listed repo whose working tree differs from its ref, **Then** its files are read at the ref.

### User Story 2 - A file named without a path is found (Priority: P2)

**Acceptance Scenarios**:

1. **Given** a file whose text says `first-steps` or `CompositionRoot`, and exactly one file of its repo (or of the repo its kind cites) has that name less its extension, **Then** "mentioned by name" lists it.
2. **Given** a name that several files share, or a one-word name (`setup`), **Then** it is not listed.
3. **Given** a file that names the target both by path and by name, **Then** it is listed only as direct.
4. Mentions make no chain: the same word can name something else.

### User Story 3 - TypeScript imports are paths (Priority: P2)

Measured on the reference repo: `GetDocument.ts` had 0 direct references, because TypeScript ESM imports write `./GetDocument.js`, and the tests import through the alias `@/…`.

**Acceptance Scenarios**:

1. **Given** `import … from './Widget.js'` and a `Widget.ts` beside it, **Then** the importing file is a direct reference.
2. **Given** `compilerOptions.paths` in the repo's root `tsconfig.json` (comments and trailing commas allowed), **Then** an import through an alias resolves, using the longest matching alias, relative to `baseUrl` when set.

## Requirements *(mandatory)*

- **FR-001**: References are indexed across all present repos. A file of another repo is shown as `<repo id>:<path>`.
- **FR-002**: The registry gains two optional fields: `web` on a repo and `cites` on a kind (`schemas/atlas.schema.md`). AT-6 checks `cites`.
- **FR-003**: `--explain` prints `mentioned by name:` between the direct list and the chains.
- **FR-004**: Scenarios first. Every new rule is caught by a scenario when sabotaged.

## Success Criteria *(mandatory)*

- **SC-001**: `tests/atlas`: 48 scenarios (was 34); the whole suite passes (437).
- **SC-002**: 28 of 28 explain sabotages and 16 of 16 `fail`/`warn` sites are caught.
- **SC-003**: On the real repos, `CompositionRoot.ts` goes from 3 to 9 direct references and `GetDocument.ts` from 0 to 11. The agent-config pin file is a direct reference of the reference repo files it names, and a chain through the declared edge.

## Out of scope

- tsconfig `extends`, or a `tsconfig.json` anywhere but the repo root.
- Names that are one word, or that several files share.
