# Research: A navigation map and coordinator for agent-config

## DR-001: Registry format
- **Tree path:** none
- **Criteria:** The tool is installed under `~/.copilot` with no `node_modules`, like the other validators. The repo already writes registries as one flow mapping per line (`mapping.yaml`, the `roles:` and `profile_dimensions:` blocks of `conventions.md`), parsed without a YAML library.
- **Options considered:** A. YAML with one flow mapping per line | B. Full YAML with a parser dependency | C. JSON
- **Chosen:** A — the same style the repo uses elsewhere, readable, commentable, and parsed with no dependency.
- **Rejected:** B — a dependency for an installed tool; C — no comments, noisier to read and review.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** engineering · **Approved at:** G3 (2026-10-29)

## DR-002: Which files the map covers
- **Tree path:** none
- **Criteria:** V: "it should mention everything, even if it's nested deeply". Generated pages must be identical on every machine, or the up-to-date check (AT-5) fails in CI.
- **Options considered:** A. Every file git tracks or would track (`git ls-files --cached --others --exclude-standard`), plus a walk when the folder is not a git repo | B. Only Markdown files | C. Only files under `copilot/`
- **Chosen:** A — every file, so nothing is reachable only by knowing its name; the ignore rules keep machine-local files out.
- **Rejected:** B — scripts, configs and tests would stay off the map; C — wrappers, skills, specs and tests are exactly the files a newcomer cannot find today.
- **Confidence:** high
- **Supersedes:** none
- **Decided by:** human · **Approved at:** G1 (2026-10-29)

## DR-003: Reference repos on the map
- **Tree path:** none
- **Criteria:** The map must cover the reference repos (Clarifications Q3), but CI clones only agent-config, and generated pages must not depend on what is cloned.
- **Options considered:** A. One generated folder per repo (`map/<repo>/`), checked only when that repo's root is present (`--repo <id>=<path>` or its registered root) | B. Vendor the reference repo's file list into agent-config | C. Leave reference repos out
- **Chosen:** A — the registry declares their areas and kinds once; their pages are written and checked wherever the clone exists, and skipped with a warning elsewhere.
- **Rejected:** B — a second copy that drifts with every reference release; C — against the clarified scope.
- **Confidence:** medium
- **Supersedes:** none
- **Decided by:** engineering · **Approved at:** G3 (2026-10-29)

## Verification

| What | How | Result |
|---|---|---|
| Scenarios | `pnpm test` on Node 24.22.2 | 23 atlas scenarios pass (414 in the suite) |
| Every check is guarded | Each of the 15 `fail(`/`warn(` calls replaced by a no-op in turn | 15 of 15 caught (the cross-repo parent check was missed by the first draft; a scenario was added) |
| The real map | `atlas.mjs --write` on agent-config and the layer-first reference at v1.5.1 | 674 files under 67 kinds in 27 areas; no file without a kind (AT-1), no empty kind (AT-2) |
| Found while building | Scenarios and the real run | A file link computed from the wrong repo root (fixed); nested repo folders listed twice (now owned by the inner repo); AT-5 noise when other rules fail (now only on a clean registry); per-area counts for ref-listed repos would differ between machines (now only for working-tree repos) |
