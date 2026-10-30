# Tasks: Install skills one link per skill (`link-each`)

- [x] T001 Back up `~/.claude/skills`; run test B; restore and compare
- [x] T002 Scenarios first (`tests/installers/`): fixture mapping uses `link-each` for skills; 5 new, 4 changed
- [x] T003 `apply_link_each` in `installers/lib/link-or-copy.sh`; `uninstall.sh` removes entry links only
- [x] T004 `Invoke-LinkEachMapping` in `installers/lib/link-or-copy.ps1`; `uninstall.ps1`
- [x] T005 `mapping.yaml` uses `link-each` for both skills targets; README "Install strategies"
- [x] T006 Install option A on this machine; call the coordinator
- [x] T007 Revert to the whole-folder link at V's request; keep this spec as the record
