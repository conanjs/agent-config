# Security decisions: spec 022 (P4, run R-001)

**Role:** security, `mode: decide` · **Date:** 2026-11-13 · **Inputs:** `specs/022-repo-split/spec.md` (G2 approved 2026-11-13), `specs/022-repo-split/blueprint.md` (v3.1), `.specify/memory/constitution.md` 1.0.0, `trees/risk-tier.tree.md` (RT), foundations Q-SEC, THR, DS, Q-REL, RUB.

**How to use this file.** Section 1 is the risk-tier decision record; copy it into `research.md` when P4 writes it (renumber the id if `DR-001` is taken). Sections 2 to 4 are the threat model the HIGH tier requires before G3. Section 5 lists the mitigations; each must become a task at P5 with `[Sec]` review. Section 6 lists the risks only V can accept.

**Not reopened:** the company KB stays public (V's choice at G2). Nothing below depends on it being private.

---

## 1. Risk tier

## DR-001: Risk tier
- **Tree path:** RT-Q1 (YES) → HIGH. RT-Q2 and RT-Q3 also answer YES (recorded for the P6 re-check; the first YES decides).
- **Criteria:**
  - RT-Q1, secrets and personal data. The installer merges into `~/.claude/settings.json` (AC-12.3), a file that can hold `env` tokens and an `apiKeyHelper`; it copies that file into `~/.agent-config-backups/<timestamp>/` (AC-7.3); it clones with V's git credentials (A-17). Rendered copies hold V's username in real paths (blueprint, Rendering row; spec Edge Cases), which is personal data, and agents send loaded text to their model providers.
  - RT-Q2, exposure. The feature decides which code runs with V's full user rights on every session start, every prompt and every tool call: hooks merged into Claude Code, Codex and Copilot hook files (FR-039, AC-12.1), Model Context Protocol (MCP) servers registered per agent (AC-12.7), a session-start re-render hook (FR-046). Each component's `component.yaml` can contribute such entries. That is a permission change for the user account, the closest analogue of an IAM change on a laptop.
  - RT-Q3, untrusted input and networked dependency. New parsing of fetched files (`component.yaml`, Markdown, skill and agent sources, `{{include:}}`); git fetches from URLs in two lists; content repos follow `main`, so any push reaches V's machine.
  - No regulated data class and no compliance regime in the constitution: the RT-Q1 escalation clause does not fire.
- **Options considered:** LOW | MEDIUM | HIGH
- **Chosen:** HIGH — the feature controls what code and what always-loaded instructions every agent runs with V's rights, and it handles a file that can hold secrets.
- **Rejected:** MEDIUM — it would skip the threat table before G3 and per-task security review, yet one malformed `component.yaml` can make an agent run any command at session start; LOW — the fast path's LOW requirement (conventions §8) cannot hold for an installer that writes agent hook files.
- **Confidence:** high
- **Supersedes:** none (P1 did not consult security; blueprint "Security tier" row)
- **Decided by:** security · **Approved at:** G3 (pending)

**What HIGH switches on (RT trade-off table):** STRIDE table in `plan.md` before G3 (sections 2 to 4 below, to be copied in); the test-depth tree's security branch forced (unit tests mandatory for every mitigation in section 5); security review on every task in this feature (narrowed at G4 to the nine blocker-mitigation tasks, plan.md Security); security sign-off before G5. A tier only rises; lowering it needs a new record approved by V.

---

## 2. Scope

**Assets**
| Id | Asset | Why it matters |
|---|---|---|
| A1 | V's user account on Mac and Windows | Every hook, service and built skill script runs with its full rights |
| A2 | `~/.claude/settings.json`, `~/.codex/hooks.json`, `~/.copilot/hooks/*.json`, MCP registrations | They decide what runs; settings may hold tokens |
| A3 | V's secrets on disk (`~/.ssh`, `~/.aws`, git credential store, tokens in settings `env`) | Reachable by any code the agents run, and by file copies the renderer makes |
| A4 | Always-loaded agent text: core, routes, rendered copies, skill list | Instructions every agent obeys; also leaves the machine to model providers |
| A5 | The governance guard (workflow-graph `PreToolUse` and `UserPromptSubmit` hooks) | Enforces gates; spec 019 D6 chose fail-closed |
| A6 | `components.lock`, `install-state.json`, backups | Record of what is installed and the way back |
| A7 | V's username in rendered paths | Personal data, low sensitivity |

**Actors**
| Actor | Trust |
|---|---|
| V at a terminal | Trusted; the only one who can consent |
| An agent driving the installer (AC-4.3: "scripts and agents") | Semi-trusted: obeys whatever text it reads, including injected text |
| A component (git repo or local folder) | Untrusted input: V writes all four today, but a stolen GitHub token, a merged hostile pull request, or a `path` source pointed at a downloaded folder makes it hostile |
| GitHub and the network | Untrusted transport and host |
| Another session starting at the same moment | Concurrent writer |

**Entry points:** `install`, `plan`, `doctor`, `set`, `add`, `use`, `init-component`, `uninstall`, `--json` (FR-016, FR-028); the session-start re-render hook (FR-046); the post-merge hook (AC-12.5); each provider's CI build (AC-11.9).

## 3. Data flow and trust boundaries

```
GitHub ──B1 (fetch)──▶ managed clone ─┐
local folder ──B8 (live link)─────────┤
                                       ▼
                    B2: installer parses component.yaml, docs, sources
                       │ build (FR-038)  │ render (FR-045)  │ merge (FR-039)
                       ▼                 ▼                  ▼
          generated/ skills, copies   routes, core      hook files, MCP registrations
                       └──────B4──────────┴───────B3─────────┘
                                       ▼
                     agent session (V's rights) ──▶ model provider (A4, A7 leave the machine)
   NEEDS report / --json ──B5──▶ agent or script that drives the installer
   session start ──B6──▶ re-render hook ──▶ generated/
   installer ──B7──▶ backups, lock, install-state on disk
```

| Boundary | Crossing | From less trusted → more trusted |
|---|---|---|
| B1 | Network fetch of `git` sources | GitHub → V's disk |
| B2 | Parsing a component's files | Component → installer process |
| B3 | Writing hook files and MCP registrations | Installer output → code the agents execute |
| B4 | Rendered or linked text loaded at session start | Component text → agent instructions |
| B5 | Report text read by an agent | Component-supplied strings → agent actions |
| B6 | Unattended re-render at every session start | Changed source → generated copy |
| B7 | Backups and state files | Installer → disk readable by other local processes |
| B8 | `path` source linked live | Any folder V names → agent home |

## 4. Threat table (STRIDE-lite)

STRIDE = Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege. Rating = likelihood × impact for a single-user machine whose components V writes.

| Id | B | STRIDE | Threat | Rating | Mitigation |
|---|---|---|---|---|---|
| T-01 | B1 B3 | E, T | A hostile or compromised component adds or changes a hook, an MCP service, a status line or a skill script. The next `install` merges it, and it then runs as V on every session start or tool call. The spec has no consent step for this: FR-022 guards only *fetching* a suggested source, and content repos follow `main`, so one push is enough | High | M-01, M-02 |
| T-02 | B2 | T, E, I | Path traversal through component-controlled names and paths: `name` (→ `components/<name>/`, `generated/<name>/`), `locations`, `exports`, route file names, skill and agent names (→ `~/.claude/skills/<name>`), `{{include:}}` targets, citation paths with `..`. Effect: writes outside the home (overwriting `~/.claude/settings.json` or `~/.ssh/authorized_keys`), or reads any file into a rendered copy | High | M-03 |
| T-03 | B2 B4 B8 | I | A symlink inside a component points at `~/.ssh/id_ed25519` or `~/.aws/credentials`. The renderer or build copies the target into `generated/`, a route or skill makes agents load it, and the secret goes to a model provider | High | M-04 |
| T-04 | B1 | E | The clone itself runs code: recursive submodule clones (CVE-2024-32002 targets case-insensitive file systems with symlinks, the default on Mac and Windows; CVE-2025-48384 writes a hook through a carriage return in `.gitmodules`); a URL or ref starting with `-` read as a git option; `ext::` or `file::` transports | Medium | M-05 |
| T-05 | B6 B8 | E | The session-start hook runs git inside a `path` source to read its commit SHA. Git honours that folder's own `.git/config`, so `core.fsmonitor` can name a command that `git status` runs, unattended, at every session | Medium | M-06 |
| T-06 | B5 B7 | I | A source URL with credentials (`https://user:token@github.com/…`) is echoed in the lock, `plan`, `doctor`, `--json` and the NEEDS report, which agents read and send to their provider | Medium | M-07 |
| T-07 | B4 | I | A secret stored as a variable value (`set GITHUB_TOKEN=…`) is rendered into `generated/global-variables.md`, which every agent loads (FR-025) | Medium | M-08 |
| T-08 | B3 | T | The settings merge corrupts or drops V's keys (parse error, concurrent write by Claude Code itself, a merge that rewrites the whole file), or lets a component add `permissions.allow`, `env`, `apiKeyHelper` or MCP auto-approval | High | M-09 |
| T-09 | B7 | I | Backups of `settings.json` and of replaced real folders (AC-7.3) are created readable by other local users or processes | Medium | M-10 |
| T-10 | B4 B5 | S, E | Prompt injection. (a) Route, core or skill text from a component tells agents to run commands or send files. (b) NEEDS-report text (a component's "suggested source", AC-4.5) is phrased as a ready command, and an agent driving the installer runs `add` + `install`. That bypasses "never fetch without asking V". The same goes for the first-run home confirmation (AC-2.1) | High | M-11, M-01 |
| T-11 | B6 | T | Two sessions start together, or an install is interrupted, and an agent reads a half-written copy or hook file | Medium | M-12 |
| T-12 | B6 | D | The re-render hook hangs or runs long (a large component, a network call, a slow disk), which delays every session start | Low | M-13 |
| T-13 | B3 | E (fail-open) | The guard hook moves to the agentic-sdlc component. If its command stops resolving (a compatibility link retired under FR-031, the component off in this project, a rendered path changed), the shell exits 127. Claude Code treats every exit code other than 2 as a non-blocking error and runs the tool anyway (hooks reference, "Exit code output"). The guard turns off silently, contradicting spec 019 D6 ("deny, with the reason"). Today's edge case "a hook for an agent that is not installed: `doctor` warns only" hides it | High | M-14 |
| T-14 | B3 | E | Command injection in generated hook commands: a home path with spaces (`Vinh Do`, spec Edge Cases), `$`, backticks or quotes, substituted into bash or PowerShell command strings | Medium | M-15 |
| T-15 | B7 | R | Nothing records who installed which code when: `generated/` is rebuilt, and lock and state show only the current version | Low | M-16 |
| T-16 | B1 | T | A tag moves (agentic-sdlc pins a tag, A-5) or `main` advances, and a different commit installs while the lock suggests a pin | Medium | M-02 |
| T-17 | B2 | T, D | The installer's YAML parser is a new dependency that parses untrusted input: custom tags, alias expansion ("billion laughs"), very large files | Medium | M-17 |
| T-18 | B2 | E | A variable `detect` rule (FR-025, AC-6.4) or a build step runs a command the component supplied | High if allowed | M-18 |
| T-19 | B4 | I | V's username in rendered paths leaves the machine in agent context and in pasted `doctor` output | Low | AR-3 (accept); AC-16.10 keeps it out of repos |
| T-20 | B1 | T | Each provider's CI pins `build@major`, and a major tag can move | Low | M-19 |

**Not a security control:** read-only rendered files (FR-046) stop accidental edits only; the owner, and any agent with a shell, can change the permission. Do not count it as integrity protection.

## 5. Required mitigations

Severity follows Q-SEC defaults. A **blocker** must be in `plan.md` before G3 and its task done before that phase's PR merges. Mitigations that change what V sees need a spec amendment at that phase's start, which the spec already plans ("Depth"). They are marked "amend".

| Id | Mitigation (testable) | Threats | Phase | Severity | Rule ids | Spec link |
|---|---|---|---|---|---|---|
| M-01 | **Consent for privileged entries.** `plan` computes the privileged set: each hook (event, matcher, command), MCP service, status line and route, per agent. When `install` finds any entry new or changed compared with `install-state.json`, it exits 10 with a "privileged changes" need that shows each entry in full and the component and commit it comes from, and writes nothing. Approval records the approved set's hash. The session-start and post-merge hooks never change the privileged set; they re-render content only and leave a pending change for `doctor` to report | T-01, T-10, T-20 | 2 (mechanism), 3 (routes), 4 (skill and agent text), 5 (hooks, services, status line) | blocker | Q-SEC-8, THR-7, SEC-R6 | amend: new AC under US4 and US12 |
| M-02 | **Install stays on the lock.** `install` checks out the SHA in `components.lock`. Advancing a `git` source (to the tip of `main` or a new tag) is an explicit step that prints the commit range and, through M-01, any privileged change. A pinned tag that now resolves to a different SHA than the lock exits 1 ("tag moved") | T-01, T-16 | 2 | blocker | THR-6, Q-SEC-7 | amend: AC-3.1, FR-020; open question 2 |
| M-03 | **Names and paths are allow-listed and contained.** Component, skill, agent, route and hook ids match `^[a-z0-9][a-z0-9-]{0,63}$`. Every path field from a component is relative, has no `..` segment, no drive letter, no `\` and no NUL. Before each read or write, the resolved real path (symlinks followed) must lie under the expected root: the component root for reads, the home or the named agent folder for writes. `uninstall` uses `lstat`, removes links, never follows them, and never deletes recursively through a link. Schema rules ship in phase 0 (`component/v1`), enforcement in phase 2 | T-02 | 0, 2, 4, 5 | blocker | Q-SEC-3, Q-SEC-4, THR-5 | FR-004, FR-005 |
| M-04 | **No symlink escape.** Managed clones use `core.symlinks=false`, so a symlink becomes a plain file holding the target text. The renderer and build refuse any symlink whose real path leaves the component root: the component fails, and the others install (FR-005 pattern). `doctor` reports out-of-root symlinks in linked `path` sources (the knowledge base) | T-03 | 2, 4, 5 | blocker | Q-SEC-5, THR-8 | AC-7.5 (new `doctor` fault) |
| M-05 | **Safe git invocation.** Git runs as a process without a shell, with `--` before URLs and paths. Refs and URLs starting with `-` are refused. `GIT_ALLOW_PROTOCOL=https:ssh` is set. There are no submodules: clone with `--no-recurse-submodules`, and a component with `.gitmodules` warns that submodules are ignored. `GIT_TERMINAL_PROMPT=0` is set when stdin is not a terminal. Every fetch has a timeout (DS-2). The installer requires a git release that carries both CVE fixes; 2.50.1 or later is the simplest floor, and 2.50.1 (Apple Git-155) is installed on this Mac (checked 2026-11-13) | T-04 | 2 | blocker | THR-5, DS-2, Q-REL-2 | AC-5.9 pattern (runtime check) |
| M-06 | **No git porcelain in `path` sources.** Change detection uses file times, or reads `.git/HEAD` and the ref file directly. If git must run there, it runs as `git -c core.fsmonitor= rev-parse HEAD`, never `git status` | T-05 | 5 | major | Q-SEC-4 | FR-046 |
| M-07 | **No credentials in sources.** A source URL with a user-info part (`user:pass@`) fails validation with a message naming the component only, not the URL. Every report (`plan`, `doctor`, `--json`, NEEDS, errors) redacts user-info and `?token=` style parts. Credentials stay in git's credential helper or `ssh-agent` | T-06 | 2 | major | Q-SEC-5, THR-1 | amend: FR-019 |
| M-08 | **Variables are not secrets.** `component/v1` states that variables are public values loaded by agents. `set` refuses names containing `TOKEN`, `SECRET`, `PASSWORD` or `APIKEY`/`API_KEY`, and values matching common token prefixes (`ghp_`, `github_pat_`, `sk-`, `AKIA`, `xox`). `doctor` re-checks the rendered file | T-07 | 2 | major | Q-SEC-5, THR-1 | amend: AC-6.1 |
| M-09 | **Scoped, atomic settings merge.** The merge touches only installer-owned entries under `hooks` (and the core's `statusLine`), each marked as installer-owned; a component can contribute no other key (`permissions`, `env`, `apiKeyHelper`, MCP auto-approval). If the file does not parse, the install exits 1 and writes nothing. The write is a temporary file plus rename, after re-reading the file and checking its hash is unchanged since read. A backup comes first (AC-12.3). The same rules apply to `~/.codex/hooks.json` and `~/.copilot/hooks/agent-config.json` | T-08 | 5 | blocker | Q-SEC-8, THR-7, Q-REL-6 | AC-12.3 (extend) |
| M-10 | **Private files stay private.** The home, `~/.agent-config-backups/` and every backup are created owner-only (`0700` folders, `0600` files; on Windows the user's own access list, inheritance off). `doctor` warns when any of them is readable by others | T-09 | 2 | major | Q-SEC-6, THR-8 | AC-7.3 (extend) |
| M-11 | **Reports are data, and consent is V's.** A NEEDS item that comes from component text is labelled "suggested by `<component>`, unverified" and is never printed as a ready-to-run command. Home confirmation (AC-2.1, AC-2.5) and privileged-change approval (M-01) need an interactive terminal; with no terminal they exit 10. The core instructions gain one line: agents never run `add`, `use` or an approval from a NEEDS report without V's approval in chat. Route and skill text is in the M-01 privileged set; ordinary doc changes are accepted risk AR-2 | T-10 | 2, 5 | blocker | Q-SEC-3, THR-5 | amend: AC-4.5, AC-2.1; FR-048 neighbour |
| M-12 | **One writer at a time.** A home-wide lock file with a stale-lock timeout is taken by `install`, `uninstall` and the re-render hook. Every write to `generated/` and to agent hook files is a temporary file plus rename. The second concurrent run waits, or exits 1 naming the lock | T-11 | 2, 5 | major | Q-REL-6, DS-4 | Edge Cases (interrupted install) |
| M-13 | **A bounded session-start hook.** The re-render hook does no network I/O, renders only components whose source changed, stops under its own time budget, which is shorter than the agent's hook timeout, keeps the old copy on timeout (AC-16.9), and caps rendered file size | T-12 | 5 | major | DS-2, Q-REL-4 | AC-16.8, AC-16.9 |
| M-14 | **The guard stays fail-closed through the move.** `doctor` fails (not warns) on any merged hook whose command path does not resolve; the "agent not installed" warning stays only for agents absent from the machine. `retired:` refuses to remove a compatibility link that any merged hook command still uses. Merged hook commands use the real home path, never a compatibility path. Phase 5 adds a test that deletes the guard script and checks that `doctor` exits 1 | T-13 | 2 (`retired:`), 5 | blocker | SEC-R1, Q-SEC-8, THR-10 | AC-7.5, AC-8.3; edge case "hook for an agent that is not installed" |
| M-15 | **Quoting per shell.** One tested function quotes paths for bash and one for PowerShell. Tests cover a home containing a space (`Vinh Do`), `$`, a backtick, `'` and `"`. A home path containing a newline or NUL is refused | T-14 | 5 | major | Q-SEC-4 | Edge Cases (spaces) |
| M-16 | **Install log.** An append-only `{{AGENT_HOME}}/install-log.jsonl`, outside `generated/`, holds time, command, component, source (redacted), SHA before and after, and approved privileged changes | T-15 | 2 | minor | Q-SEC-10 | — |
| M-17 | **YAML parser risk record.** A decision record from tech-stack for the parser (THR-6): pinned by lock file, `cmd.audit` clean, safe schema (no custom tags), alias limit on, size cap per file (for example 256 KiB). Following spec 019 D9, prefer reading YAML only in the installer and keeping hooks parser-free | T-17 | 2 | major | Q-SEC-7, THR-6, SEC-R6 | — |
| M-18 | **No component code at install.** `detect` rules are declarative only (an environment variable name, a path probe inside the home); they never run a command. The build runs only agent-config's pinned build tool and never runs a script from a component. `{{include:}}` follows M-03 | T-18 | 2, 4 | blocker | THR-7, Q-SEC-4 | AC-6.4, AC-11.5 |
| M-19 | **CI pins by SHA.** Provider CI references the build tool by full commit SHA; the contract still promises compatibility by major (conventions §13 cites GitHub's secure-use guidance) | T-20 | 4 | minor | THR-6 | AC-11.9 |

### Fail-open review (SEC-R1)

| Design point | Verdict |
|---|---|
| Unknown keys warn (FR-005, tolerant reader) | Acceptable: an unknown key adds nothing. M-01 still sees every privileged entry the reader does understand |
| Unsupported slot or major: skip that component only (AC-5.8) | Acceptable: less gets installed, never more |
| Failed re-render: keep the old copy, the session starts (AC-16.9) | Acceptable: falls back to content V already accepted, and `doctor` fails |
| Missing hook command: non-blocking in Claude Code (T-13) | **Fail-open; fixed by M-14** |
| Wrapper skips the guard when no Node.js ≥ 24.12 is found (`workflow-graph-hook.sh` header) | Already fail-open today, against spec 019 D6. Not new in 022, but the move makes Node lookups more varied. Needs V's decision (open question 3, AR-4) |
| Spec as written: privileged entries merged without consent (T-01) | **Fail-open; fixed by M-01, M-11.** Not a veto at P4, because the plan can still add the step. It becomes a veto at P6 if a phase 5 hook-merge task ships without M-01 |
| `path` source missing: exit 1, old links kept (AC-3.3) | Fail-closed |
| Variables unresolved: exit 10, nothing changed (FR-016) | Fail-closed |

## 6. Accepted risk, for V to sign off (`Decided by: human`)

| Id | Risk | Proposed acceptance | Why |
|---|---|---|---|
| AR-1 | Approved hooks and MCP services run with V's full user rights; nothing is sandboxed | Accept, with M-01 consent per change | No sandbox exists for agent hooks on any of the three platforms; consent plus a pinned SHA is the practical control |
| AR-2 | Ordinary doc content in a component (not routes, hooks, services or skill text) changes without consent and is loaded by agents as context | Accept | Requiring consent for every doc edit would make updates unusable; the agents' own permission prompts still gate actions |
| AR-3 | V's username appears in rendered paths that reach model providers | Accept | Agents already send the working directory; AC-16.10 keeps the username out of every repo |
| AR-4 | The guard does nothing when Node.js is missing | V decides: keep it (accept) or make it deny, only in folders with `.specify/runs` | Spec 019 D6 says to deny; the wrapper's header says denying every call would stop all work |

## 7. Unconfirmed, to check at P4 with a cheap model (AGENTS.md rule)

- Codex and Copilot CLI behaviour when a hook command is missing or exits with a code other than 0 or 2: is it blocking or not? Only Claude Code's behaviour is documented below. Until checked, M-14 applies to all three agents.
- Whether Claude Code exports an environment marker to the shells it starts (for example `CLAUDECODE=1`) that the installer could use, together with the terminal check in M-11. Unconfirmed; M-11 relies on the terminal check alone.

## Sources

- Claude Code hooks reference, "Exit code output": exit 2 blocks; any other non-zero exit is a non-blocking error and execution continues. https://code.claude.com/docs/en/hooks
- Codex hooks: `PreToolUse` denies with exit 2 or `permissionDecision: "deny"` (`copilot/knowledge/ai-agents/codex-usage-reference.md`, row `PreToolUse`); behaviour on other exit codes unconfirmed.
- Spec 019 `research.md` D6 (hook failure: deny) and D9 (hooks stay parser-free); `copilot/frameworks/agentic-sdlc/tools/workflow-graph/workflow-graph-hook.sh` header (no Node: call left alone).
- CVE-2024-32002, Git recursive clone on case-insensitive file systems: https://nvd.nist.gov/vuln/detail/CVE-2024-32002
- CVE-2025-48384, Git `.gitmodules` carriage-return hook write: https://nvd.nist.gov/vuln/detail/CVE-2025-48384
- Git `GIT_ALLOW_PROTOCOL` and `protocol.allow`: https://git-scm.com/docs/git#Documentation/git.txt-codeGITALLOWPROTOCOLcode ; https://git-scm.com/docs/git-config#Documentation/git-config.txt-protocolallow
- Git `core.fsmonitor` (runs a configured command): https://git-scm.com/docs/git-config#Documentation/git-config.txt-corefsmonitor
- GitHub Actions secure use (pin a full SHA): https://docs.github.com/en/actions/reference/security/secure-use
- Microsoft STRIDE: https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats
