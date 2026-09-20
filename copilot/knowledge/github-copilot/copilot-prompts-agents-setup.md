# VS Code Copilot — Prompts, Agents & Instructions Setup

Personal reference for Copilot customization: file types, discovery rules, settings, frontmatter, and gotchas confirmed through real use.

---

## 1. File Types at a Glance

| File type | Extension | Default discovery paths | Purpose |
|---|---|---|---|
| **Instructions** | `.instructions.md` | `.github/instructions/` (recursive), `~/.copilot/instructions/` (recursive) | Conditional context — applied based on `applyTo:` glob or semantic relevance, NOT always-on by default |
| **Prompts** | `.prompt.md` | `.github/prompts/`, `~/.copilot/prompts/` | Reusable task templates, invoked via `/` in chat |
| **Agents** | `.agent.md` | `.github/agents/`, `~/.copilot/agents/` | Custom chat modes with persona, tools, instructions |
| **Skills** | `SKILL.md` in folder | `.github/skills/`, `~/.copilot/skills/` | Specialized capabilities: invokable via `/`, auto-loaded by Copilot when relevant, or referenced from prompts and instructions. **Own frontmatter schema, stricter than the others — see §7.** |

---

## 2. Chat Mode: Local vs Copilot

VS Code has two distinct chat modes. Which mode you're in determines what agents and prompts are available.

| Mode | How to identify | Agents available | Prompts via `/` |
|---|---|---|---|
| **Local** | Status bar shows "Local" at bottom left | All agents from all configured paths (User Data, Workspace, settings paths) | All prompts for the active agent |
| **Copilot** (cloud) | Status bar shows "Copilot" | Only built-ins (Agent, Ask, Plan) + `~/.copilot/agents/` (User Data) | Limited |

**⚠️ Prompts from external paths (e.g., `ne-copilot`) only appear when in Local mode.**  
Switching to Local: click the mode label in the status bar at the bottom of the chat panel.

The agent dropdown in Local mode shows all agents: `agent1`, `booking`, `figma-to-code`, `manage-shipment`, `owasp-security-checker`, etc. — anything loaded from any source.

---

## 3. Instruction Types: Always-On vs File-Based

> **Source:** [VS Code custom instructions official docs](https://code.visualstudio.com/docs/agent-customization/custom-instructions)  
> ⚠️ **Correction from earlier notes.** `.github/instructions/*.instructions.md` files are NOT "loaded whenever the workspace is open." They are **file-based (conditional)** instructions. See below.

VS Code has two distinct instruction categories that behave very differently.

---

### Category 1 — Always-on instructions

Automatically included in **every** chat request, regardless of which files are in context.

| File | Default location | Notes |
|---|---|---|
| `.github/copilot-instructions.md` | Workspace root | Single file; applied to all chat in that workspace |
| `AGENTS.md` | Workspace root | Multi-agent compatible; also supports subfolders (experimental) |
| `CLAUDE.md` | Workspace root, `.claude/`, or `~/` | For Claude compatibility |
| Organization instructions | GitHub org level | Applies across all repos in the org |

These files need no `applyTo:` field — they are unconditionally loaded.

---

### Category 2 — File-based instructions (conditional)

`*.instructions.md` files. Whether they are applied depends entirely on the frontmatter. They are **NOT** automatically loaded just by being present in `.github/instructions/`.

The agent determines whether to apply a given `.instructions.md` by:

| Trigger | How |
|---|---|
| **`applyTo:` glob matches** | If the glob matches files currently in context, the instructions are applied automatically |
| **Semantic match on `description:`** | The agent can load the file if its description matches the current task, even without `applyTo:` |
| **Manual attachment** | User explicitly drags/attaches the file to a chat prompt |
| **No `applyTo:`, no match** | ❌ File is NOT applied — must be attached manually |

```yaml
# Always applied (matches all files — effectively always-on):
---
applyTo: "**"
---

# Only applied when editing cargo-release files:
---
applyTo: "src/modules/cargo-release/**"
---

# Never auto-applied — must be manually attached:
---
name: "Reference notes"
description: "Background context on shipment architecture"
# no applyTo:
---
```

**Default locations (searched recursively — subdirectories ARE supported):**
- Workspace: `.github/instructions/`
- User: `~/.copilot/instructions/`
- Additional locations: `chat.instructionsFilesLocations`

```
.github/instructions/
  frontend/
    react.instructions.md      ← ✅ discovered (recursive scan)
  backend/
    api-design.instructions.md ← ✅ discovered
```

> ⚠️ **Recursive support is instructions-only.** Agents and prompts are one-level-deep only. Instructions are the exception — they recurse into subdirectories.

---

### Understanding `~/.copilot/instructions/` ("global")

Often called "global" because files here apply across all workspaces — but they are still **file-based instructions**, subject to the same `applyTo:` rules.

- `personal-defaults.instructions.md` has `applyTo: '**'` → applied on every request in every workspace ✅
- A file in `~/.copilot/instructions/` with **no `applyTo:`** → NOT applied automatically, even though it is "global"

The "always-on everywhere" behavior comes from `applyTo: '**'`, not from being in `~/.copilot/`.

---

### Summary table

| File | `applyTo:` | Applied automatically? | Scope |
|---|---|---|---|
| `.github/copilot-instructions.md` | N/A (always-on type) | ✅ Every request | Current workspace |
| `AGENTS.md` | N/A (always-on type) | ✅ Every request | Current workspace |
| `~/.copilot/instructions/personal-defaults.instructions.md` | `**` | ✅ Every request, every workspace | Everywhere (wildcard) |
| `.github/instructions/cargo-release.instructions.md` | `src/cargo-release/**` | ✅ When glob matches context | Workspace, matching files only |
| `.github/instructions/reference.instructions.md` | *(none)* | ❌ Manual only or semantic match | Must be attached by user |

---

## 4. Two Repo Patterns: Own vs Shared (ne-copilot)

### Pattern A — Self-contained repo (auto-scan; no subdirectory support)

Each repo owns its own `.github/` folder. VS Code scans it automatically when that repo is open — **one level deep only, no configuration needed, and no subdirectory support**.

```
api-portal-frontend/
  .github/
    agents/
      owasp-security-checker.agent.md   ✅ auto-discovered
      eCOM/
        my-other-agent.agent.md          ❌ NEVER discovered — subdirs not auto-scanned
    prompts/
      fix-vulnerability.prompt.md        ✅ auto-discovered
      sub-folder/
        another.prompt.md                ❌ NEVER discovered
    instructions/
      coding-conventions.instructions.md
```

**Pattern A rule:** there is no setting that makes own-repo subdirectories work automatically. If you add an explicit `settings.json` path pointing to that subdirectory, you are now using Pattern B behaviour.

---

### Pattern B — Shared copilot repo (ne-copilot pattern)

One repo (`ne-copilot`) holds agents/prompts for all eCOM projects. Each consuming project references it via explicit paths in `settings.json`.

**Key difference from Pattern A:** because you control exactly which directory the setting points to, you CAN point directly at a subdirectory — and files flat inside that subdirectory will be discovered normally.

```
ne-copilot/
  .github/
    agents/
      manage-shipment.agent.md      ← option 1: flat at root — works when settings → flat root
      eCOM/
        booking.agent.md            ← option 2: in subdir — works when settings → eCOM/ explicitly
        manage-shipment.agent.md    ← works when settings → eCOM/ explicitly
    prompts/
      eCOM/
        manage-shipment/            ← subdir — needs settings to point here explicitly
          create-shipment-flag.prompt.md
          fix-vulnerability.prompt.md
```

Settings registration (global or workspace):

```json
// ~/Library/Application Support/Code/User/settings.json
// OR <workspace>/.vscode/settings.json

"chat.agentFilesLocations": {
  ".github/agents": true,
  "~/.copilot/agents": true,
  // Option 1: point to flat root — picks up manage-shipment.agent.md at root
  "~/workspace/ots-projects/ne-copilot/.github/agents": true,
  // Option 2: point explicitly to the subdir — picks up agents flat inside eCOM/
  "~/workspace/ots-projects/ne-copilot/.github/agents/eCOM": true
},
"chat.promptFilesLocations": {
  ".github/prompts": true,
  "~/.copilot/prompts": true,
  // Must point to the exact leaf dir — one entry per subdirectory
  "~/workspace/ots-projects/ne-copilot/.github/prompts/eCOM/manage-shipment": true
}
```

> ℹ️ Use global `settings.json` for shared-copilot-repo setup — consuming repos don't own the `ne-copilot` files and shouldn't commit references to it in `.vscode/settings.json`.

---

### Agent subdirectory support — comparison table

The one-level-deep rule means: VS Code scans only the **registered directory itself**, not any directory inside it. This applies equally to Pattern A auto-scan and Pattern B explicit paths — the difference is that Pattern B lets you register any directory, including a subdirectory.

| Scenario | File location | Registered path | Discovered? |
|---|---|---|---|
| Pattern A — own repo, flat | `api-portal-frontend/.github/agents/my.agent.md` | auto-scan | ✅ Yes |
| Pattern A — own repo, subdir | `api-portal-frontend/.github/agents/sub/my.agent.md` | auto-scan | ❌ No — subdirs never auto-scanned |
| Pattern B — external, flat root | `ne-copilot/.github/agents/manage-shipment.agent.md` | settings → `ne-copilot/.github/agents` | ✅ Yes |
| Pattern B — external, subdir, path points to subdir | `ne-copilot/.github/agents/eCOM/booking.agent.md` | settings → `ne-copilot/.github/agents/eCOM` | ✅ Yes |
| Pattern B — external, subdir, path points to parent | `ne-copilot/.github/agents/eCOM/booking.agent.md` | settings → `ne-copilot/.github/agents` | ❌ No — one level too deep |

**Rule of thumb:** the one-level scan applies to whichever directory is registered. Point the setting at the exact directory containing the `.agent.md` files — root or subdirectory, both work.

---

## 5. Agent Discovery Rules

### `name:` field is required
VS Code matches `agent: 'manage-shipment'` in prompt frontmatter against the **`name:`** field in `.agent.md` — not the filename.

```yaml
---
name: manage-shipment   ← REQUIRED for prompt agent: field to resolve
description: Use when working on ONE Shipment Management Platform
---
```

Missing `name:` → warning: `Unknown agent 'manage-shipment'. Available agents: agent, ask, edit, ...`

### One-level-deep scan only (confirmed)

VS Code does NOT recurse into subdirectories. Agent files must be **flat in the registered directory** — which can be any directory you explicitly point at.

| File location | Settings registered path | Discovered? |
|---|---|---|
| `ne-copilot/.github/agents/manage-shipment.agent.md` | `ne-copilot/.github/agents` | ✅ Yes |
| `ne-copilot/.github/agents/eCOM/manage-shipment.agent.md` | `ne-copilot/.github/agents/eCOM` | ✅ Yes — subdir registered explicitly |
| `ne-copilot/.github/agents/eCOM/manage-shipment.agent.md` | `ne-copilot/.github/agents` (parent only) | ❌ No — one level too deep for registered path |

For **own-repo agents** (Pattern A, auto-scan), the registered path is always `.github/agents/` root — subdirectories are never discovered regardless of any settings.

### What `chat.agentFilesLocations: true` actually does

Setting a path to `true` has **two distinct effects**:

| Effect | Condition |
|---|---|
| Resolves `agent: 'x'` in prompt frontmatter → suppresses "Unknown agent" error | ✅ Always — regardless of mode or file depth |
| Makes the agent truly loadable in the UI agent picker | ✅ Only when **both**: (1) `.agent.md` is flat in the registered dir, **and** (2) you are in **Local mode** |

**Corrected understanding:** the "suppresses error but agent never loads" experience was caused by being in **Copilot (cloud) mode**, not by a path mismatch. Once in Local mode with the path correctly registered, the agent loads fully.

Path depth still matters independently:
- Path → `eCOM/`, file flat at `eCOM/booking.agent.md` → ✅ loads in Local mode
- Path → `eCOM/`, file at `eCOM/sub/booking.agent.md` (one level deeper) → ❌ error suppressed but never loads, even in Local mode

### Multi-root workspace behaviour

VS Code scans `.github/` of the **workspace root** only. In a multi-root workspace with many sub-projects, sub-project `.github/` folders are ignored.

**Reliable fix:** explicit absolute paths in global `settings.json` (Pattern B above), or place files in `~/.copilot/agents/` (always loaded regardless of workspace).

### Two agent UI surfaces

| Surface | Access | Shows |
|---|---|---|
| **Bottom bar quick-switch** | Click "Agent" in bottom bar | `~/.copilot/agents/` (User Data) + built-ins only |
| **Full agent picker** (Local mode) | Sidebar chat → agent dropdown | All agents from all sources |
| **Configure Custom Agents...** | Last item in agent picker | Opens the `.agent.md` file for editing (not a mode switch) |

`~/.copilot/agents/` agents (e.g., `agent1`) appear in both surfaces.  
Settings-path agents (e.g., `manage-shipment`) appear only in the full picker in **Local mode**.

---

## 6. Prompt Discovery Rules

### One-level-deep scan (same as agents)

Prompts must be **flat** in the configured directory, or each subdirectory must be explicitly added.

```json
// prompts/eCOM/ is configured — only files directly in eCOM/ are found
// prompts/eCOM/manage-shipment/*.prompt.md are NOT found

// Fix: add the subdir explicitly
"chat.promptFilesLocations": {
  "~/workspace/ots-projects/ne-copilot/.github/prompts/eCOM": true,
  "~/workspace/ots-projects/ne-copilot/.github/prompts/eCOM/manage-shipment": true
}
```

### `agent:` field — sets the runner, not a visibility filter

> ⚠️ **Corrected from earlier notes.** Official VS Code docs confirm: `agent:` specifies **which agent is used to run the prompt** when invoked — it is NOT a visibility filter.

The `agent:` field in a prompt's frontmatter tells VS Code which agent context should execute the prompt when you type `/prompt-name`. It does not restrict who can see the prompt in the `/` picker.

| `agent:` value | Effect when prompt is invoked |
|---|---|
| `agent: 'manage-shipment'` | Prompt runs using the `manage-shipment` custom agent (its tools, persona, instructions) |
| `agent: 'ask'` | Prompt runs in read-only Ask mode — no code edits, just answers |
| `agent: 'agent'` | Prompt runs in full agent mode with all tools enabled |
| *(not set)* | Uses whatever agent is currently active when you invoke the prompt |

**Concrete example:**

```
You are in agent = ask (built-in).
Type "/create-shipment-flag" → prompt appears, you can invoke it.
VS Code switches to manage-shipment agent to run it (because agent: 'manage-shipment').

You are in agent = manage-shipment.
Type "/create-shipment-flag" → same result, agent is already correct.
```

**Why prompts previously only appeared when manage-shipment was active:**  
The real cause was **Local mode**, not agent filtering. The manage-shipment prompts come from an external path (`ne-copilot`) that only loads in Local mode. Once you're in Local mode, all configured prompts appear in `/` regardless of which agent is currently selected.

**⚠️ Unconfirmed:** whether VS Code additionally uses `agent:` to filter `/` picker visibility (i.e., hide prompts whose agent isn't active). The official docs make no mention of this behaviour. Treat any such observation as mode/path issues first.

**To use manage-shipment prompts:**
1. Switch to **Local** mode (status bar bottom-left)
2. Type `/` → manage-shipment prompts appear (regardless of which agent is active)
3. Invoke the prompt → VS Code automatically uses the `manage-shipment` agent to run it

---

## 7. Skill Frontmatter — Supported Fields

**Source:** confirmed 2026-08-28 via [official VS Code agent skills docs](https://code.visualstudio.com/docs/agent-customization/agent-skills), [GitHub's Copilot CLI skills docs](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills), and the live error text from VS Code's own SKILL.md validator, while porting 3 external skills into the `one-ai-armor` repo (`skills/common/systematic-debugging/`, `root-cause-tracing/`, `defense-in-depth/`).

Skill frontmatter (`SKILL.md`) uses a **different, stricter schema than prompt frontmatter** (section 8 below) — don't assume prompt fields carry over.

### `name:` — required, and stricter than it looks

```
Regex: ^[a-z0-9]+(-[a-z0-9]+)*$   (lowercase, digits, single hyphens only)
```

- **Must exactly match the parent folder name.** `skills/common/systematic-debugging/SKILL.md` must have `name: systematic-debugging`, not `name: Systematic Debugging`.
- ⚠️ **Failure mode is silent.** Per VS Code's own docs: *"Names with invalid characters cause the skill to silently fail to load."* No error dialog, no red squiggle at runtime — the skill just never activates. (VS Code's editor-time validator DOES show a red squiggle while you're editing the file — that's the one case you get a warning. The runtime load path does not.)

### `description:` — required, and it's the ONLY signal used for auto-invocation

Per GitHub's own docs: *"The description field is the only thing Copilot reads to decide whether to load your skill."*

**Consequence:** any "when to use this" trigger condition belongs **inside `description:`**, not in a separate custom field. A separate `when_to_use:`/`trigger:`/etc. field is never read by the auto-invocation logic — write it as a trailing sentence in `description:` instead:

```yaml
# ❌ Info Copilot never reads for auto-invocation:
description: Four-phase debugging framework.
when_to_use: when encountering any bug, before proposing fixes

# ✅ Same info, actually used to decide when to load the skill:
description: Four-phase debugging framework that ensures root cause investigation before attempting fixes. Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes.
```

### Full supported field list (top-level frontmatter keys)

Confirmed from a live VS Code Copilot validator error message (the authoritative, current list — more current than the public doc page, which is inconsistent/lagging when scraped):

```
name, description, license, metadata, argument-hint, user-invocable, disable-model-invocation, context, compatibility
```

| Field | Purpose |
|---|---|
| `name` | Required. Lowercase-hyphenated, must match folder name. |
| `description` | Required. Sole signal for auto-invocation — embed trigger conditions here. |
| `license` | Optional. License identifier (e.g. `MIT`). |
| `metadata` | Optional. **Nested object** — the catch-all for custom provenance fields (see below). |
| `argument-hint` | Optional. Hint text shown when invoked as a slash command. |
| `user-invocable` | Optional. Whether it appears in the `/` menu (default `true`). |
| `disable-model-invocation` | Optional. Disables automatic loading by the agent (default `false`). |
| `context` | Optional. `inline` or `fork` — skill loading mode. |
| `compatibility` | Optional. (Purpose not yet exercised in practice — flag if you find a concrete use.) |

Anything else at the top level (`when_to_use`, `version`, `languages`, `author`, `origin`, `tags`, `domain`, …) is **not part of the spec** and got flagged by VS Code's validator in practice. Nest that kind of custom/provenance info under `metadata:` instead of at the top level:

```yaml
---
name: systematic-debugging
description: Four-phase debugging framework... Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes.
license: MIT
metadata:
  origin: obra/superpowers-skills
  author: Jesse Vincent (obra)
  version: 2.1.0
  languages: all
---
```

### Real incident this was learned from

Ported 3 skills from `obra/superpowers-skills` (upstream Claude-Code-flavored frontmatter) into `one-ai-armor`. Upstream used `name: Systematic Debugging` (Title Case, space) + a `when_to_use:` field — both are Claude-Code/superpowers conventions, not part of the shared spec VS Code/Copilot CLI validate against. VS Code's editor surfaced both as explicit errors on open; fixed by lowercasing `name:` to match the folder and folding `when_to_use:` into `description:`.

**Known related bug found but not yet fixed (as of 2026-08-28):** `skills/common/debug-issue/skill.md` in the same repo has `name: Debug Issue` (Title Case) and is named `skill.md` (lowercase) instead of `SKILL.md` — almost certainly silently failing to load per the rule above. Pre-existing, unrelated to the port above.

---

## 8. Prompt Frontmatter — Supported Fields

Supported fields as of 2025-08:

```
agent, argument-hint, description, model, name, tools
```

| Field | Status | Notes |
|---|---|---|
| `name` | ✅ Supported | Display name in the `/` picker |
| `description` | ✅ Supported | Shown under the name in the picker |
| `agent` | ✅ Supported | Specifies which agent **runs** the prompt when invoked (not a visibility filter) |
| `argument-hint` | ✅ Supported | Single string hint shown in chat input |
| `model` | ✅ Supported | Override model for this prompt |
| `tools` | ✅ Supported | Restrict available tools |
| `title` | ❌ Unsupported | Use `name` instead |
| `arguments` | ❌ Unsupported | Use `argument-hint` instead |

`argument-hint` is a **single string**, not an array. Required args first, optional in `[brackets]`:

```yaml
argument-hint: "flagKey=ne-12345-my-feature [module=shipment-overview]"
```

---

## 9. YAML Frontmatter Gotchas

Any description string with `: true` or `: false` must be **quoted** or YAML throws "Nested mappings not allowed":

```yaml
# Broken:
description: Whether to include API layer (default: true)

# Fixed:
description: "Whether to include API layer (default: true)"
```

---

## 10. Prompt Template Syntax

Only `{{variableName}}` is supported — no pipe/filter transforms:

```
✅  {{flagKey}}
❌  {{flagKey | camelCase}}    ← renders literally, never transforms
```

JSX double-brace `value={{ a, b }}` conflicts with template syntax — use an intermediate variable in code examples.

**⚠️ Unverified interaction, flagged not tested:** this repo's knowledge base separately uses `{{VAR}}` as its own convention for path/preference variables resolved by an agent reading `global-variables.md` (e.g. `{{AGENT_HOME}}`, `{{OTS_REPOS_ROOT}}` — see `~/.copilot/global-variables.md`). Both conventions use identical `{{name}}` syntax but resolve completely differently: Copilot's prompt templating substitutes `{{name}}` at *invocation time*, using only names declared via `argument-hint`, directly in the `.prompt.md` file's own text; the knowledge-base convention is resolved by the *agent*, at *read time*, for content in *other* files it opens as a tool action. A `.prompt.md` file's own body is the only place these two could actually collide (content in files the prompt merely *tells* the agent to go read is untouched by Copilot's templating, since that pass only runs once, at prompt-load time, over the prompt file itself). Untested whether writing `{{AGENT_HOME}}` directly inside a `.prompt.md` body gets left alone, substituted as blank (undeclared arg), or errors.

**Rule for every future `.prompt.md` file in this repo:** never write a knowledge-base-style `{{VAR}}` (e.g. `{{AGENT_HOME}}`) literally in a prompt's own body — spell out the real path instead, and only tell the agent to go resolve `{{VAR}}`s inside *other* files once it's already running. Mark the file with a **one-line** comment pointing here (`<!-- {{VAR}} collision risk: see copilot-prompts-agents-setup.md §10 before adding {{AGENT_HOME}}-style vars here. -->`) rather than re-explaining the reasoning inline — this section is the single place that reasoning lives. `copilot/prompts/init-repo-kb.prompt.md` is the worked example.

---

## 11. VS Code Chat vs Copilot CLI

| Feature | VS Code Chat (Local/Copilot mode) | Copilot CLI (`gh copilot`) |
|---|---|---|
| Reads `settings.json` | ✅ | ❌ never |
| Reads `~/.copilot/` | ✅ | ✅ only source |
| Custom agents/prompts | ✅ via settings + Local mode | ❌ not supported |
| Extra instruction paths | ✅ | ❌ |

---

## References

> **Convention:** References should include both local artifacts (files, configs, tools cited in this doc) **and** authoritative external sources — official documentation pages, spec docs, GitHub blog posts, or RFCs that define or explain the concepts discussed. This helps trace knowledge to its authoritative origin.

- VS Code prompt files official docs: https://code.visualstudio.com/docs/agent-customization/prompt-files
- VS Code custom instructions official docs: https://code.visualstudio.com/docs/agent-customization/custom-instructions
- VS Code agent skills official docs: https://code.visualstudio.com/docs/agent-customization/agent-skills
- GitHub Copilot CLI — Adding agent skills: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills
- VS Code agent customization overview: https://code.visualstudio.com/docs/agent-customization/overview
- Global settings: `~/Library/Application Support/Code/User/settings.json`
- Agents (flat, canonical): `ne-copilot/.github/agents/manage-shipment.agent.md`
- Agents (organised, not scanned): `ne-copilot/.github/agents/eCOM/manage-shipment.agent.md`
- Prompts: `ne-copilot/.github/prompts/eCOM/manage-shipment/*.prompt.md`
- Skill frontmatter fix example: `one-ai-armor/skills/common/systematic-debugging/SKILL.md`, `root-cause-tracing/SKILL.md`, `defense-in-depth/SKILL.md`
- Dead-code rules: `{{AGENT_HOME}}/knowledge/dead-code/dead-code-rules.md`

## Related

- `{{AGENT_HOME}}/knowledge/dead-code/dead-code-rules.md` — tracing rules referenced by `remove-dead-code.prompt.md`
- `{{AGENT_HOME}}/knowledge/github-copilot/copilot-cli-internals.md` — CLI-specific internals
- `one-ai-armor` repo `skills/README.md` and `CONTRIBUTING.md` — this team's own skill-authoring conventions (kept in sync with section 7 above)
