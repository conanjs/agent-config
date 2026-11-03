# Tasks: An interface catalog for the workflow-graph tool

- [x] T001 Remove V's R-007 test run (files kept in the session scratchpad), commit spec 020 on `feat/workflow-runner`, cut `feat/interface-catalog`
- [x] T002 One folder per run: `RunFolderLayout` names every run path; repository, settings store, launch journal and LangGraph engine take it by constructor; scenarios pin the layout (D49)
- [x] T003 Usage spec `interfaces/workflow-graph.usage.kdl`: every command, flag, argument, exit code and effect
- [x] T004 JSON Schemas: graph, ledger line, run settings, launch journal line, hook input and output per agent
- [x] T005 `catalog` module: `CliDescription`, `UsageSpecFile` (`@bgotink/kdl`), `HelpPresenter`, `CatalogMarkdown`, `CheckInterfaces` (IF-1 … IF-8), `FsCatalogFiles`, `CatalogCliHandler`, `CatalogRoot.ts` (loaded on demand)
- [x] T006 Per-command option tables as `static options` on every handler; `AgentCliHandler` on `parseArgs` (D53)
- [x] T007 `main.ts`: `--help`, `-h`, `help <cmd>`, `--version`; usage errors on stderr with exit 2; no stack traces (D54)
- [x] T008 `ENVIRONMENT` list in `CompositionRoot.ts`; `INTERFACES.md` and `catalog-info.yaml`; generated sections written by `interfaces --write`
- [x] T009 Tests: schema contract tests against real ledger lines, settings, journal and hook replies; planted fault per IF rule; scenarios for help, version, usage errors, and the catalog check on the real tool and a broken copy
- [x] T010 `check-docs.sh` runs `workflow-graph interfaces`, and `usage lint` when installed
- [x] T011 Framework: CON-15, CON-16 and format rows in `contract-design.md`; the architecture role loads it (D50); the ledger's `log` field in `workflow-graph.schema.md` (D52)
- [x] T012 Root `INTERFACES.md` and `catalog-info.yaml` (Location) listing every program; spec 019's `contracts/cli.md` and `hooks.md` marked replaced
- [ ] T013 Run `usage lint` on the spec once the `usage` CLI is installed (`brew install usage`); add `usage diff --breaking` to CI once the tool has a release tag
