# Tasks: The workflow runner

- [x] T001 Spec, plan, research (D21–D28), worker spike
- [x] T002 Graph: `launches` on phase nodes in `workflow.graph.yaml`; `check-graph` rule (roles exist, modes valid); rule WG-31 (runner rules WG-32 … WG-37 in the same schema, one rule prefix)
- [x] T003 Scenarios (8; written after a scripted smoke run, then proven by sabotage) in `tests/workflow-graph/workflow-graph.feature` (one feature per tool) with the scripted fake launcher: start → stops at G0; resume after a chat approval → stops at G2; a `question` reply escalates; P6 task in a worktree merges after pass; checks fail within budget then escalate; a started-but-unfinished launch stops for attention; `run approve` without a terminal is refused
- [x] T004 Runner domain classes and unit tests (RoleReply, AgentAssignment, RunSettings, LaunchPrompt)
- [x] T005 HeadlessLauncher port and the three adapters (contract suite on recorded command lines)
- [x] T006 Application: RunAdvancer, StartRun, ResumeRun, ApproveGate
- [x] T007 Infrastructure: LangGraphRunEngine, GitWorktrees, ShellCheckCommands, JsonlLaunchJournal, TtyHumanConsole, FakeHeadlessLauncher
- [x] T008 CLI `run start | approve | resume`; composition root; hook timing unchanged
- [x] T009 Docs: SETUP, README, atlas, orchestrator note, knowledge
- [x] T010 Sabotage: 8 of 8 caught (WG-31 … WG-37, WG-35 twice)
- [x] T011a Live SC-002 (2026-11-03, Claude Code 2.1.129 headless): a fresh project with `--mission "Add a function sum(numbers: number[]): number …"`; P1's product-spec and architecture ran in propose mode (2 min 25 s), both replied `message/v2` → `done`, the run stopped at G0; after `approve G0 R-001` typed through the chat approval hook and `run resume`, product-spec (execute) wrote `specs/001-sum/spec.md` and `research.md` in the run worktree, committed as `R-001 P3`, the main checkout untouched; stopped at G2; `check-run` passes. Project kept for review at `/Users/vinh.doq/.wg-live-run-O5MO`
- [ ] T011b Live SC-003: continue that run through P4, P5 and one P6 task in its own worktree (several more paid launches; waits on V)

