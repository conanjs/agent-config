# Contracts: spec 022

Sketches of the fifteen cross-repo contracts and of agent-config's own installer interface, frozen at G3 (CON-1, contract-design procedure step 5). Phase 0 turns each sketch into `contracts/<name>/v1/` at the agent-config root: `schema.json` (JSON Schema 2020-12), `README.md` (rules, worked examples, missing or stale behaviour) and `examples/` (valid and invalid fixtures shared with the reader's parity test, DR-103). Those files, not these sketches, are what tasks and other repos read after phase 0.

Rules for every contract: the id is `name/vN`; components pin the major only (FR-006); readers accept the current and the previous major; a major bump follows DR-418 (reader first, providers before consumers, drop N-1 when `doctor` shows no user); unknown keys warn (CON-10); compatibility is diffed against the last `contracts/v…` tag on every commit (FF-6).

| # | Contract | Sketch | Owner | Consumers | Missing or stale on a machine | Record |
|---|---|---|---|---|---|---|
| 1 | `slots/v1` | [slots-v1.md](slots-v1.md) | agent-config | installer, doctor, `build cite`, renderer | Unknown slot: that component skipped, warning (AC-5.8) | DR-401 |
| 2 | `component/v1` | [component-v1.md](component-v1.md) | agent-config | installer, build, atlas, doctor, renderer, `build cite` | Manifest missing: component skipped, `doctor` fails, core works | DR-402 |
| 3 | `components-list/v1`, `components-lock/v1` | [components-list-and-lock-v1.md](components-list-and-lock-v1.md) | agent-config | installer, doctor, `add`, `use`, `plan` | Acquire or validation fails: previous version stays linked | DR-403 |
| 4 | `knowledge-provider/v1` | [knowledge-provider-v1.md](knowledge-provider-v1.md) | agent-config (definition); agent-knowledge, agent-companies provide | core, agentic-sdlc, agent-companies, installer, doctor | No route, layer skipped; `doctor` lists dead citations | DR-404 |
| 5 | `company-kb/v1` | [knowledge-provider-v1.md](knowledge-provider-v1.md#company-kbv1) | agent-knowledge (in agent-config until phase 6) | agent-companies, `init-repo-kb`, agentic-sdlc | agent-companies not installed; NEEDS names `knowledge-storage` | DR-405 |
| 6 | `rendered-copy/v1` | [rendered-copy-v1.md](rendered-copy-v1.md) | agent-config renderer | agents, doctor, uninstall, session-start hook | `doctor` fails naming the source; `install` restores | DR-406, DR-307 |
| 7 | `routes/v1` | [routes-hooks-variables-v1.md](routes-hooks-variables-v1.md#routesv1) | agent-config renderer | the three agents | `doctor` hash check; re-render hooks | DR-407 |
| 8 | `skill-source/v1` | [build-v1.md](build-v1.md#skill-sourcev1) | agent-config | build; providers agent-config, agentic-sdlc | Same skill twice: the second fails | DR-408 |
| 9 | `agent-source/v1` | [build-v1.md](build-v1.md#agent-sourcev1) | agent-config | build; providers agentic-sdlc, agent-config | Budget and tool-restriction warnings | DR-409 |
| 10 | `adapter-fields/v1` | [build-v1.md](build-v1.md#adapter-fieldsv1) | agent-config | build, doctor | Stale `verified` warns; stamp mismatch fails `doctor` | DR-410 |
| 11 | `build/v1` | [build-v1.md](build-v1.md#buildv1-the-tool) | agent-config | every repo's CI, installer, doctor | Stamp or adapter mismatch fails `doctor`; previous output stays | DR-411, DR-304 |
| 12 | `repo-layout/v1` | [build-v1.md](build-v1.md#repo-layoutv1) | agent-config | CI of all four repos | Repo CI fails (report mode in agent-config until phase 8) | DR-412 |
| 13 | `hooks/v1` | [routes-hooks-variables-v1.md](routes-hooks-variables-v1.md#hooksv1) | agent-config renderer | the three agents' hook files | Unresolvable merged hook command: `doctor` fails (M-14) | DR-413 |
| 14 | `variables/v1` | [routes-hooks-variables-v1.md](routes-hooks-variables-v1.md#variablesv1) | agent-config | every component, installer, agents | Required value missing: exit 10, nothing changed | DR-414 |
| 15 | `framework/v1` | [build-v1.md](build-v1.md#frameworkv1) | agent-config | installer (`enable`, `disable`), doctor | Not enabled: no skills or agents in that project | DR-415 (Q8) |

**In-repo interfaces** (agent-config only; listed in its `INTERFACES.md` with a usage spec and JSON Schemas, CON-15, CON-16): the installer CLI, its `--json` report and `install-state/v1`: [installer-cli.md](installer-cli.md).

Security rules that cut across several contracts (DR-001, `plan.md` "Security"): ids `^[a-z0-9][a-z0-9-]{0,63}$` and contained relative paths (M-03); no credentials in source URLs (M-07); variables are public values (M-08); `detect` is declarative (M-18); routes, hooks, services, status line and skill or agent text are privileged and need consent when new or changed (M-01).
