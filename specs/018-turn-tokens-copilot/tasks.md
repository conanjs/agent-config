# Tasks: The turn token report for GitHub Copilot

- [x] T001 Read the Copilot hooks reference, the VS Code hooks and instructions pages, and the billing docs; read this machine's Copilot logs (`research.md`)
- [x] T002 TT-13 … TT-16 in `copilot/hooks/turn-tokens/turn-tokens.schema.md`; TT-1, TT-4, TT-11 extended
- [x] T003 Scenarios first (`tests/turn-tokens/`, Copilot fixture log): 9 failed before the code existed
- [x] T004 `--hook copilot` in `turn-tokens.mjs`
- [x] T005 `copilot/hooks/turn-tokens.json`; `.gitignore` keeps fixture `session-state/` folders; atlas; SETUP; README; `copilot-usage-reference.md`
- [x] T006 Sabotage: 17 of 17 caught
- [x] T007 Real log: per-call credits = Copilot's checkpoint (182.21); live `copilot -p`: report shown, 9.22 AI credits = Copilot's own footer
- [ ] T008 V: reload VS Code; confirm whether a Copilot turn in VS Code shows the report
