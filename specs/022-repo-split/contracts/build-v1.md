# Build-time contracts: `skill-source/v1`, `agent-source/v1`, `adapter-fields/v1`, `build/v1`, `repo-layout/v1`, `framework/v1`

## `skill-source/v1`

**Owner:** agent-config · **Providers:** agent-config, agentic-sdlc · **Consumer:** build · **Record:** DR-408 · **Spec:** FR-038, FR-047, AC-11.1, AC-11.5, AC-11.8, AC-12.4

```yaml
# skills/<name>/skill.yaml   (+ body.md, references/…)
schema: skill-source/v1
name: review-docs                        # ^[a-z0-9][a-z0-9-]{0,63}$ (M-03)
description: "Review knowledge docs and procedures before committing …"
targets: [claude, agents]                # one build target per discovery folder: claude → ~/.claude/skills, agents → ~/.agents/skills
metadata: { owner: agent-config }        # custom data; emitted only where an adapter maps it
fields: {}                               # common standard fields
platforms:                               # overlays; cascade: common < adapter defaults < overlay
  claude: { allowed-tools: [Read, Grep, Bash] }
  agents: {}
includes: true                           # body.md may use {{include:<relative path>}}; contained (M-03); a missing file fails with its path (AC-11.5)
```

Built at install into `store/`, rendered, then linked **entry by entry** into the two skill folders from phase 4 (skills synced from elsewhere are left alone). The same skill name from two components: the second fails naming both (AC-11.8). Skill text is privileged (M-01, from phase 4).

## `agent-source/v1`

**Owner:** agent-config · **Providers:** agentic-sdlc (`sdlc-*`), agent-config (`foundry-*`, `windows-software`) · **Record:** DR-409 · **Spec:** AC-11.1, AC-11.3, AC-11.4

```yaml
# agents/<name>/agent.yaml (+ body.md)
schema: agent-source/v1
name: sdlc-system-architecture
description: "Agentic SDLC System Architecture role …"
model-tier: top
auto-delegate: false                     # → Copilot CLI infer: false; VS Code disable-model-invocation (AC-11.3)
needs-project-instructions: true         # → include-custom-instructions: true
preload: [sdlc-system-architecture-preset]   # → Claude `skills:`; an include in the Codex body
tools: { intent: [read, search, edit, shell] }   # Codex cannot restrict tools → build warning
targets: [claude, copilot, codex]
platforms: {}
```

Linked entry by entry into `~/.claude/agents`, `~/.codex/agents` and `~/.copilot/agents` (Copilot's own folder, AC-8.2) from phase 4. Claude Code warns above 15,000 tokens of descriptions.

## `adapter-fields/v1`

**Owner:** agent-config `adapters/<name>/fields.yaml` · **Consumers:** build, doctor · **Record:** DR-410 · **Spec:** AC-11.1, AC-11.2, AC-11.7

```yaml
schema: adapter-fields/v1
adapter: copilot
version: 1                               # adapter major; removing a field bumps it; stamped into output
targets:
  agents: { folder: ~/.copilot/agents, file: "{name}.agent.md", link: per-entry }
  skills: { folder: ~/.agents/skills, file: SKILL.md, link: per-entry }
fields:
  - name: infer
    applies-to: agent
    from: { auto-delegate: false }
    source: https://docs.github.com/…    # an official doc URL, never a KB path (no edge into agent-knowledge)
    verified: 2026-11-10
    enforced: true
events:                                  # hooks/v1 neutral names → platform names
  session-start: <platform event name>
  pre-tool: <platform event name>
```

A new platform is one new folder under `adapters/` and nothing else (G3, AC-11.7).

## `build/v1` (the tool)

**Owner:** agent-config `contracts/tools/` · **Consumers:** each repo's CI (pinned to a full SHA of a `contracts/v…` release, M-19), the installer, doctor · **Record:** DR-411, DR-304, DR-106 · **Spec:** FR-038, FR-044, FR-047, AC-1.7, AC-9.5 to AC-9.7, AC-11.6, AC-11.9

| Subcommand | Does | Notes |
|---|---|---|
| `build` | Reads skill and agent sources with the adapters' field lists; writes deterministic output (sorted keys, LF, no timestamps) stamped with source revision and adapter majors | Runs only agent-config's own code, never a component script (M-18); refuses out-of-root symlinks (M-04) |
| `budget [--baseline]` | Counts rendered characters (Unicode code points) per agent against `idle-cost` and the total ceiling; `--baseline` is the phase-0 dry run that renders in memory and writes the baseline record (AC-1.7) | Same render rules as the renderer (A-28) |
| `cite [--write] --provider <component.yaml path or URL> … --slots <slots.yaml>` | Classifies each citation by the longest location mount, fails on a path under no location, checks it against the provider's exports, writes `depends.slots[].docs` and the GitHub target with `--write`, fails on a missing or stale target or a provider without `repository` | Each repo runs it on its own files (G12) |
| `layout [--report]` | Checks `repo-layout/v1` | Report mode in agent-config until phase 8 |

Interface: a usage KDL spec plus a JSON Schema for the `--json` report (CON-15, CON-16); exit codes 0 ok, 1 failed, 2 usage error (A-8). Depends on nothing outside `contracts/` (DR-302).

## `repo-layout/v1`

**Owner:** agent-config · **Consumers:** CI of all four repos · **Record:** DR-412 · **Spec:** FR-012, AC-1.1, AC-16.10

```yaml
contract: repo-layout/v1
required: [README.md, component.yaml, AGENTS.md, CHANGELOG.md, INTERFACES.md, catalog-info.yaml, atlas.yaml, scripts/check.sh, tools/, tests/]
required-if-content: [index.md]
forbidden: ["a tracked file whose first line is the generated-from line", "build-output folders"]   # AC-16.10
exceptions:
  agent-config: ["scripts/check-docs.sh and the validate-docs check stand in for scripts/check.sh until phase 8"]
```

Blocking in each new repo from its first commit; report mode in agent-config until phase 8. Each repo's `INTERFACES.md` lists its `component.yaml` as a provided file interface linking to the `component/v1` schema.

## `framework/v1`

**Owner:** agent-config · **Provider:** agentic-sdlc (later agent-foundry) · **Consumers:** installer (`enable`, `disable`), doctor · **Record:** DR-415 (pending Q8) · **Spec:** AC-1.4, AC-14.1 to AC-14.4

| Id | Rule |
|---|---|
| FW-1 | `index.md` at the root of the `framework` location |
| FW-2 | Skills, agents and routes are exposed only in projects where `enable` ran; files stay readable in the home |
| FW-3 | `enable <project>` adds links under the project's `.claude/` and `.agents/` and lists them in `.git/info/exclude`; `disable` removes exactly those (AC-14.3) |
| FW-4 | Its validators take every outside input as an argument; no hard-coded folder of another repo (AC-14.4) |

Rollout: phase 0 schema; phase 7 implementation. `enable` and `disable` are subcommands of the installer that phase 7 adds; the spec amendment for them comes with phase 7's own amendment ("Depth").
