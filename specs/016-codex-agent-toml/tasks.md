# Tasks: Codex agent wrappers that Codex can read

- [x] T001 Reproduce: `codex exec` (0.164.0-alpha, in the ChatGPT app) warns "Ignoring malformed agent role" for all 12 wrappers
- [x] T002 Scenarios first in `tests/validate-sdlc/validate-sdlc.feature`: 3 added, 2 red
- [x] T003 WRAP: escapes in the basic strings of every `codex/agents/*.toml` (`tomlEscapeError` in `validate.mjs`)
- [x] T004 The 12 wrappers use `'''` literal strings; role-wrapper schema rule
- [x] T005 Sabotage: 11 targeted breaks of the check, plus every `fail`/`warn` call
- [x] T006 Verify: validator, `tomllib`, `codex exec` with no warning
