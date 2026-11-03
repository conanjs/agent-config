# Research: The workflow runner

## Decisions

| # | Question | Options | Chosen | Why |
|---|---|---|---|---|
| D21 | Which agent per role | one per run · one per run with per-role override · a full mapping | per run + override | V, 2026-11-03 |
| D22 | Where unattended P6 edits happen | worktree per task · the user's checkout · no unattended edits | worktree per task | V, 2026-11-03; also keeps P1–P5 and P7 artifacts out of the user's checkout (run worktree) |
| D23 | How a gate is answered | runner exits, approve later · runner waits in the terminal | exits; `run approve` or the chat approval hook, then the runner continues | V, 2026-11-03; survives a closed terminal |
| D24 | First scope | full path, tasks in order · with parallel tasks · planning only | full path, tasks in order | V, 2026-11-03 |
| D25 | Where the runner code lives | own package (019 D12) · a module of the tool package, LangGraph loaded with `await import()` | module of the tool package | Reuses the `Run` aggregate, registry and adapters through module boundaries instead of cross-package exports; the dynamic import keeps hooks free of LangGraph (verified by hook timing) |
| D26 | What the runner treats as truth | LangGraph state · the ledger | the ledger | One source; a run driven by the runner passes `check-run`; the checkpoint can be deleted and the run resumed from the ledger |
| D27 | How `run approve` proves a person typed it | none · a stdin TTY check · a confirmation read from `/dev/tty` | `/dev/tty` | An agent's shell tool has no controlling terminal, so it cannot open `/dev/tty`; a TTY check on stdin alone is easy to fake |
| D28 | Which roles each phase launches | hard-coded in the runner · `launches` on the phase nodes of the graph | in the graph | Principle I; a reviewer sees them next to the phase |

## Spike (2026-11-03)

A fresh repo with a worktree `run/R-005`. Claude Code 2.1.129 (`-p --permission-mode acceptEdits --allowedTools "Read Write Edit"`), Copilot CLI 1.0.105 (`-p --allow-tool=write --no-ask-user`) and Codex 0.164.0-alpha.11.1 (`exec --sandbox workspace-write -C <worktree>`) each created its file in the worktree; the main checkout kept only `README.md`. Cost: Claude $0.016.

## Found while building (2026-11-03)

| # | Finding | Change |
|---|---|---|
| D29 | Task branches `run/R-001/T001` cannot exist beside `run/R-001` (git stores a branch as a file, so `run/R-001` cannot also be a folder) | Task branches are `run/<run>-<task>` |
| D30 | A LangGraph thread keeps its state between invocations, so a new pass saw the previous "attention" outcome and ended at once, returning `{}` | Each fresh pass resets `outcome`; `START` routes by the ledger alone; only a real `interrupt()` pause is resumed with `Command` |
| D31 | A task out of retries would still start an agent before the ledger refused the step | Every launch is first checked with the `Run` aggregate's `permitLaunch`, the rule the chat guard uses |
| D32 | P1 roles were never told the mission | `run start --mission "<text>"`, carried as `Mission:` in every launch prompt |
| D33 | `vitest` 5.1.0 was under a day old, and pnpm 12's `minimumReleaseAge` refused the re-resolved lockfile | `vitest` pinned to 5.0.5 (also the stack reference's version); lockfile rebuilt; `allowBuilds: better-sqlite3` in `pnpm-workspace.yaml` |
| D34 | `run approve` scenarios must not reach a person's terminal when tests run from one | The scenario harness starts the tool detached (no controlling terminal) |
| D35 | The tool's code did not follow the stack reference it cites (v4.2.0, `bfa17067`): one-line doc comments, no Prettier, and the reference's TSDoc lint (`eslint/local-docs.mjs`, `jsdoc/require-param`, `require-returns`, `implementation-summary`, `specific-summary`) left out, although TSN-13 says to copy them (V, 2026-11-03) | Copied `eslint/local-docs.mjs`, `scripts/check-doc-links.mjs` and `.prettierrc.json` from the reference; the doc rules match the reference's; every doc comment rewritten (390 findings: field docs, specific summaries, `{@link Port.member}` summaries on adapters); `check-docs.sh` now runs `prettier --check` and the link check too |
| D36 | A run looked hung: a headless agent prints nothing for minutes (Copilot with `--silent`) | Each launch prints a start and an end line with its duration on standard error, only when it is a terminal (`TerminalProgressReporter`) |
