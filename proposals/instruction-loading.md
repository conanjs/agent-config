# Proposal: Instruction loading — a small core, triggers, and files read on demand

**Status:** Approved and deployed (2026-11-09), not yet committed. Step 1 of the handoff "Global instructions, skills, and routing" (Codex workspace, 2026-11-09) grew into the full round: inventory, measurement at three levels, decisions D1–D14, and deployment. V answered D1–D6, D8, D9 and D11–D14. D7 is settled by D11: non-default patterns stay on demand. D10 is deferred (`TRACKER.md`). Where each decision landed: the core `copilot/instructions/core.instructions.md`; `copilot/references/`; `skills/{spec-kit-setup,github-governance,team-doc}`; the repo's root `AGENTS.md` and `CLAUDE.md`; `mapping.yaml`; `codex/README.md`; and the findings in `copilot/knowledge/ai-agents/instruction-wording-findings.md`.

**Scope:** every coding agent this repo configures, not one tool. Today that is Claude Code (terminal and desktop app), GitHub Copilot CLI, GitHub Copilot Chat in VS Code, and Codex (terminal and the ChatGPT desktop app). Each is measured with the tokenizer of the model it runs (section 6).

## 1. The question this document answers

> Every session in Claude Code, Copilot (CLI and VS Code) and Codex starts by loading the same three instruction files (about 3,400 tokens). Which of their clauses must be in every session, and which can be loaded only when a task needs them, without losing any rule?

A benchmark on 2026-11-07 showed what loading only a small core saves. Over 10 sessions per setup, Codex used 37% fewer input tokens and Copilot 14% fewer, and Copilot's metered usage fell 30%. Section 5 has the details. That test used a 7-line core written only for its five test prompts. This inventory covers every clause, so step 2 can build a complete core without dropping one.

**Analogy:** a kitchen keeps a one-page card on the wall (the core) and a shelf of recipe binders (references). The card says "making bread? Open the bread binder". Today, every binder is photocopied onto the wall every morning.

## 2. What loads today

| Tool | Entry file (deployed by `mapping.yaml`) | How the three files arrive | Tokens at session start |
|---|---|---|---|
| Copilot CLI | `~/.copilot/instructions/` (symlink to `copilot/instructions/`) | Loads every `*.instructions.md` there by itself | 3,431 |
| Claude Code | `~/.claude/CLAUDE.md` → `claude/CLAUDE.md` | Three `@` imports | 46 + 3,431 |
| Copilot Chat in VS Code | `~/.copilot/instructions/`, plus the folders in VS Code's `chat.instructionsFilesLocations` setting | Loads every `*.instructions.md` in them, including `copilot-lessons.instructions.md` from VS Code's own `User/prompts` folder, which is not in this repo (VS-1) | 3,431 + 206 |
| Codex | `~/.codex/AGENTS.md` → `codex/AGENTS.md` | Prose asking Codex to read them; Codex runs `cat` on all three every session | 437 + 3,431, plus at least one extra model request (section 5) |

All counts in this document so far use OpenAI's tokenizer (`tiktoken` 0.14.0, `o200k_base`), measured 2026-11-09. They are exact for OpenAI's GPT-5 models and a reference for the others. Claude models from 4.7 on produce about 30% more tokens for the same text than earlier Claude models. Section 6 gives the tokenizer step 2 uses for each agent.

| File | Bytes | Tokens |
|---|---:|---:|
| `copilot/instructions/personal-defaults.instructions.md` | 11,285 | 2,599 |
| `copilot/instructions/answer-patterns.instructions.md` | 1,546 | 372 |
| `copilot/instructions/code-review-graph.instructions.md` | 1,942 | 460 |
| `codex/AGENTS.md` | 1,897 | 437 |
| `claude/CLAUDE.md` | 197 | 46 |

## 3. Where a clause can live

| Home | Code | Loaded | Example |
|---|---|---|---|
| Core | `CORE` | Every session, in full | "Greet the user as V." |
| Trigger | `TRIG` | One line in the core; the file it names is read only when the condition holds | "On a `pattern:<name>` tag, read the pattern library." |
| Scoped rule | `SCOPE` | Only in sessions inside one repo or folder (that repo's `AGENTS.md` / `CLAUDE.md`) | "Installer backups land in `~/.agent-config-backups/`" (agent-config only) |
| Skill | `SKILL` | Name and description in the skill list; body when the task matches | `skills/review-docs/SKILL.md` → `review-docs.procedure.md` |
| Reference | `REF` | Read on demand, as the target of a trigger or skill | `patterns/no-shorthand-answers.pattern.md` |
| Maintainer note | `MAINT` | Never: text written for people editing this repo | The "Note on this integration" in `codex/AGENTS.md` |
| Drop or merge | `DROP` | Never: the same rule already lives elsewhere | Pattern summaries copied from `patterns/index.md` |

## 4. Inventory

Every clause of the five files, in file order. **Tokens** is the clause as written today, counted with `o200k_base`: exact for OpenAI's `gpt-6.1-sol` (section 6.1). For Claude Opus 5.5 and Claude Sonnet 5.5 (in Claude Code or Copilot CLI), multiply by about 1.60. **Must keep** marks the clauses the handoff names as non-negotiable: path variables, knowledge and company lookup, tracker, graph fallback, review requirements, and personal preferences.

### 4.1 `personal-defaults.instructions.md`

| ID | Line | Clause | Tokens | Home | Trigger or destination | Notes |
|---|---|---|---:|---|---|---|
| PD-0 | 1–5 | Copilot front matter (`applyTo: "**"`) | 21 | CORE | Copilot form of the core file | Codex and Claude would read it as plain text: 21 tokens |
| PD-1 | 7 | `{{VAR}}` placeholders resolve from `global-variables.md`; never guess | 106 | TRIG | "`{{VAR}}` in these docs: resolve from `~/.copilot/global-variables.md`" | Must keep. If the core uses literal paths (`~/.copilot/…`), only referenced docs need it |
| PD-2 | 8 | "Global Copilot knowledge" means `~/.copilot/knowledge`; new docs follow the Knowledge Framework and must pass its validator | 230 | TRIG + REF | Core: the phrase and "start at `knowledge/index.md`". Rules for new docs → `frameworks/knowledge/index.md` (already there) | Must keep. The writing rules matter only when editing the knowledge base, which is usually inside agent-config (see D5) |
| PD-3 | 9 | Company KB: check `companies/<company>/index.md` first; schema before writing; bootstrap missing repos with `init-repo-kb` | 267 | TRIG + REF | Core: "repo of a known company (OTS: the four `ne-*` repos) or company named → read its `index.md` first". Schema and bootstrap → `frameworks/company-kb/index.md` | Must keep. Keep the four repo names in the core so the trigger can fire |
| PD-4 | 10 | Check `patterns/index.md` before designing a reusable mechanism, plus a summary of six patterns | 266 | TRIG; summaries DROP | "Designing a reusable mechanism: check `~/.copilot/patterns/index.md` first" | The summaries duplicate `patterns/index.md` (one canonical copy, KB-8). Saves about 220 tokens |
| PD-5 | 11 | agent-config's installer backups land in `~/.agent-config-backups/<timestamp>/` | 103 | SCOPE | agent-config root `AGENTS.md` | Never needed outside this repo |
| PD-6 | 12 | Concise but complete: never cut a definition, mechanism or example | 34 | CORE | — | — |
| PD-7 | 13 | Actionable answers, exact steps | 8 | CORE | — | — |
| PD-8 | 14 | Trade-offs briefly when options differ | 12 | CORE | — | Overlaps `pattern:decision` |
| PD-9 | 15 | Minimal diffs, no unrelated refactors | 15 | CORE | — | — |
| PD-10 | 16 | Preserve project style | 8 | CORE | — | — |
| PD-11 | 17 | One focused clarifying question when ambiguous | 13 | CORE | — | — |
| PD-12 | 18 | Safe, reversible commands | 11 | CORE | — | — |
| PD-13 | 19 | Bug fixes: root cause and verification steps | 13 | CORE | — | The untagged default; `pattern:bugfix` (AP-2) adds the fixed headings |
| PD-14 | 20 | Docs and explanations: short sections, concrete examples | 13 | CORE | — | — |
| PD-15 | 21 | Greet the user as "V" at the start of every response | 22 | CORE | First line | Also the check that instructions loaded |
| PD-16 | 22 | Several actors in sequence: follow `explaining-mechanisms.pattern.md` | 41 | TRIG | Already a trigger; the pattern (13.3 KB) is the REF | — |
| PD-17 | 23 | A reply that reports work: follow `no-shorthand-answers.pattern.md` and its checklist | 75 | TRIG | Shorten to about 30 tokens; the pattern (10.5 KB) is the REF | — |
| PD-18 | 24 | Tracker: mention items that look done; add undone work with `tracker.mjs --add`; close finished ones; never edit by hand | 182 | TRIG + REF | Core: "turn leaves work undone → `tracker.mjs --add`; never edit `TRACKER.md` by hand". Flags → `tracker/tracker.schema.md` | Must keep. The session-start hook already gives the model the open items and a usage line in repos with a `TRACKER.md` (F1) |
| PD-19 | 25 | Before committing under `knowledge/` or `procedures/`, and always for text drafted in another AI chat, follow `review-docs.procedure.md` | 94 | SCOPE + SKILL, plus a one-line TRIG | `skills/review-docs` (exists); agent-config `AGENTS.md`; core line (D5) | Must keep |
| PD-20 | 26 | Spec Kit setup: follow `spec-driven-development.procedure.md` | 44 | SKILL | New thin skill → the procedure | Rare task |
| PD-21 | 27 | GitHub governance files: follow `init-github-governance.procedure.md`; contents live in `templates/github-repo/` | 89 | SKILL | New thin skill → the procedure | Rare task |
| PD-22 | 28 | Technical term: plain-English analogy and one concrete example | 24 | CORE | — | Shapes every explanation |
| PD-23 | 29 | Shorthand: define every symbol, give a worked example with real dates, spell out abbreviations at first use | 88 | CORE | Compress to about 30 tokens | The abbreviation part repeats the no-shorthand checklist |
| PD-24 | 30 | Nested data: physical shape first; each special clause (`UNNEST`) with before and after rows | 46 | TRIG + REF | "Explaining SQL or nested data: read `<new reference>`" | Merge with PD-25 into one new reference |
| PD-25 | 31 | SQL: input and output row shape after each transformation | 36 | TRIG + REF | Same reference as PD-24 | — |
| PD-26 | 32 | Knowledge docs and Confluence pages end with References and Related | 99 | DROP + TRIG | Knowledge docs: already required by the knowledge schema (KB-12, checked by the validator). Confluence: the team-doc skill (PD-30) | — |
| PD-27 | 33 | Uncertain about tool behavior: research and cite; otherwise say it is unconfirmed | 78 | CORE | — | Evidence versus hypothesis |
| PD-28 | 34 | Record anything tested or measured in the knowledge base in the same turn, with version and date | 112 | TRIG + REF | Core: one line; where and how → `frameworks/knowledge/index.md` | Applies in any repo |
| PD-29 | 35 | A document changed from an external source gets its reference URL in the same turn | 53 | DROP | Merge into PD-28's line | — |
| PD-30 | 36 | Doc for V's team: use `doc-template-base.md`, Simple English, CEFR A1 | 97 | SKILL | New thin skill → `knowledge/documentation/doc-template-base.md` | — |
| PD-31 | 37 | "Deep dive", "thorough", "in detail"…: zero prior context; define every option; cross-side effects; worked example and flow; edge-case matrix; mark what was verified | 299 | TRIG + REF | Core: the trigger phrases. The five requirements → the `deepdive` pattern (D4) | Conflicts with AP-4 (F2) |

### 4.2 `answer-patterns.instructions.md`

| ID | Section | Clause | Tokens | Home | Trigger or destination | Notes |
|---|---|---|---:|---|---|---|
| AP-0 | Header | Detect a leading `pattern:<name>` (case-insensitive), strip it, apply the pattern; an unknown name → say so and use the default | 109 | CORE | One generic rule, about 45 tokens | Must keep tag stripping and the unknown-name case |
| AP-1 | `default` | Answer, Rationale, Caveats (omit if none), Next steps (omit if none) | 64 | CORE | A short default (D3) | In the benchmark, the reduced core let Copilot drop these sections for an email (F6) |
| AP-2 | `bugfix` | Root Cause, Fix, Verification Steps | 47 | REF | Pattern library | Copilot inline candidate: handoff step 3 |
| AP-3 | `decision` | Context, Options, Trade-offs, Recommendation | 71 | REF | Pattern library | — |
| AP-4 | `deepdive` | Context, Analysis, Details, Sources | 61 | REF | Pattern library, merged with PD-31 (D4) | — |
| AP-5 | `quick` | One paragraph, no headers | 20 | REF | Pattern library | Small enough to inline if measured worthwhile |

### 4.3 `code-review-graph.instructions.md`

| ID | Section | Clause | Tokens | Home | Trigger or destination | Notes |
|---|---|---|---:|---|---|---|
| CRG-0 | Header | Prefer the code-review-graph tools in an indexed repo; fall back to file search when no graph exists | 161 | TRIG | "Indexed repo: prefer code-review-graph; read `<graph guide>` before the first call; no graph → targeted file search" (about 40 tokens) | Must keep, including the fallback |
| CRG-1 | When to use | Task → tool (explore, impact, review, relationships, architecture) | 111 | REF | Graph guide | — |
| CRG-2 | Key tools | Eight tools with one line each | 122 | REF | Graph guide | The MCP server sends its own tool descriptions when connected; whether they cover this is unverified |
| CRG-3 | Workflow | Graph auto-updates; `detect_changes`, `get_affected_flows`, `tests_for` | 66 | REF | Graph guide | — |

### 4.4 Entry files

| ID | File | Clause | Tokens | Home | Notes |
|---|---|---|---:|---|---|
| EP-1 | `codex/AGENTS.md` | "Read and follow these files", with the three paths | about 100 | Replaced (D2) | Codex follows it every session; costly (section 5) |
| EP-2 | `codex/AGENTS.md` | "Note on this integration", References, Related | about 330 | MAINT | Text for maintainers, sent to the model in every Codex session (F4) |
| EP-3 | `claude/CLAUDE.md` | Three `@` imports | 46 | CORE entry | Would import the one core file instead |

| VS-1 | `~/Library/Application Support/Code/User/prompts/copilot-lessons.instructions.md` | "Copilot Lessons": rules from past mistakes, `applyTo: "**"` | 206 | Undecided (D10) | Loaded only by VS Code, and kept outside this repo, so the other agents never see it |

### 4.5 Other session-start inputs (not clauses; measure in step 3)

| ID | Input | Tokens | Notes |
|---|---|---:|---|
| OS-1 | Tracker session-start hook (`tracker.mjs --hook`) in a repo with `TRACKER.md` | 1,245 to the model and 605 shown to the user (agent-config, 15 open items, 2026-11-09) | Grows with every open item |
| OS-2 | Skill list: 17 skills in `skills/` (name and description) | about 980 | 13 are `sdlc-*` skills that matter only to the agentic SDLC framework |
| OS-3 | The tool's own system prompt and tool definitions | about 22,500 in Codex (the reduced setup's email session) | Outside this repo's control, except for which MCP servers are enabled |

## 5. Evidence

All numbers come from the Codex workspace `~/Documents/Codex/2026-11-06/referenced-chatgpt-conversation-this-is-an/`:
- `outputs/cli-instructions-benchmark.csv`: 44 scored runs.
- `outputs/graph-instructions-handoff.md`: the handoff.
- `work/bench/out/*.jsonl`: the raw event logs.

The tests ran Codex CLI 0.166.0-alpha.6 with `gpt-6.1-sol`, and Copilot CLI 1.0.105 with `claude-sonnet-5.5`. **A** is today's setup and **B** is a 7-line core with conditional reads. Five prompts ran twice per variant on each CLI.

| Sum over 10 sessions per variant | Codex A → B | Copilot A → B |
|---|---:|---:|
| Input tokens, cached included | 1,001,543 → 627,529 | 647,049 → 558,146 |
| Output tokens | 3,969 → 2,476 | 5,667 → 5,086 |
| Copilot AI units (metered usage) | not reported | 44.89101 → 31.25686 |
| Median seconds per session | 23.05 → 15.98 | 13.34 → 13.41 |

Checked on 2026-11-09:
- **The totals.** I re-added them from the CSV; all match the handoff.
- **The test copies.** Variant A's copies of the three files are byte-identical to the repo today.
- **Codex follows the pointer.** In all 10 of variant A's Codex sessions, Codex ran `cat` on the three files, the email included. With the pointer, the email took 51,137 input tokens; with the reduced core, 22,542.
  - The difference (about 28,600 tokens) is much larger than the files (3,431 tokens). The likely reason: each read adds a model request, and each request sends the whole context again. This is an inference, because Codex reports usage per turn, not per request.
  - Either way, for Codex a short core written inside `AGENTS.md` should cost less than any pointer to read. Recorded in `copilot/knowledge/ai-agents/codex-usage-reference.md`.
- **One CSV row is wrong.** The benchmark's scoring script counted a file as read only when the command exited with 0. In run 2 of the "find the caller" case with the reduced core, Codex read `services/payments/AGENTS.md` inside a chained command that exited 1, so the CSV says the file was not read. It was read. This is the only one of the 44 runs affected.

## 6. Measurement method for every agent

V uses subscriptions for Claude Code, Codex and Copilot, not API keys. So the vendors' count endpoints, which all need an API key, are out. The method below uses only what the subscriptions already record. Facts come from `copilot/knowledge/ai-agents/tokenizers-for-coding-agents.md` and the three usage-reference docs.

**Level 1: exact size of a whole file, in the model's own tokenizer.** Each agent records, for every model request, the input tokens the service counted:
- Claude Code: the transcript's `message.usage`; the context size is `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`.
- Copilot (CLI and VS Code): `inputTokens` per call in the session log.
- Codex: `turn.completed.usage.input_tokens`, which equals one request only when the turn makes no tool call.

Run the same tiny prompt ("Reply OK") twice in the same folder with the same model, once with the file and once without. The difference in the first request's input is the file's size as that model counts it. Run each pair twice to check that the number is stable, because the date, `git status` and similar context can vary. Each pair costs two short sessions of subscription quota.

**Level 2: size of each clause, as a labeled estimate.** A session per clause would take 45 clauses × 4 agents × 2 runs. Instead:
1. Count each clause with `tiktoken` `o200k_base`.
2. For each agent and model, compute one ratio: level-1 tokens ÷ `o200k_base` tokens for the same whole file.
3. Multiply each clause by that ratio, and label the result as an estimate.

For Codex the ratio should be close to 1: `o200k_base` is OpenAI's own encoding, confirmed for GPT-5 models and unconfirmed for GPT-6. For Claude it will differ: no Claude tokenizer is published.

**Level 3: real cost of a design.** The agent's usage records for whole sessions, as in the handoff's benchmark. A tokenizer cannot see the agent's system prompt, its tool list or extra model requests (section 5).

| Agent | Model | Level 1 (whole file) | Level 2 (per clause) | Level 3 (session cost) |
|---|---|---|---|---|
| Codex | OpenAI (`gpt-6.1-sol` in the benchmark) | `turn.completed.usage` difference, with the core inline (D2), so the turn has no tool call | `o200k_base`; ratio from level 1 | `codex exec --json`; rollout files |
| Claude Code | Anthropic (Opus 5.5 in this session) | Transcript `message.usage` difference; `/context` as a visual check | `o200k_base` × the Claude ratio | Transcripts; `/usage` |
| Copilot CLI | The selected model (`claude-sonnet-5.5` in the benchmark) | `inputTokens` difference in `~/.copilot/session-state/*/events.jsonl`; `/context` "Custom Instructions" as a check | `o200k_base` × the ratio for that model | Usage checkpoints; AI credits |
| Copilot Chat in VS Code | Same as Copilot CLI | Same as Copilot CLI | Same as Copilot CLI | Copilot session logs |

Not needed: API keys, or Google's `google-genai` SDK unless a Gemini model is selected in Copilot.

### 6.1 Results, 2026-11-09

**Level 1.** The text under test is the three instruction files joined into one project instructions file: 14,778 characters, 3,432 tokens in `o200k_base`. Each run started in a fresh empty git folder with the user's normal setup; the "base" file held one line, the "full" file that line plus the three files. The prompt was "Reply with the single word OK." Each number is the input of the session's first model request: from the transcript in Claude Code, from the usage checkpoint in Copilot CLI (one request per session), and from the rollout file in Codex.

| Agent | Model | Instructions file | Base → full, run 1 | Base → full, run 2 | File size in the model's tokens | Ratio to `o200k_base` |
|---|---|---|---|---|---:|---:|
| Codex CLI 0.166.0-alpha.6 | `gpt-6.1-sol` | `AGENTS.md` | 26,487 → 29,919 | 26,487 → 29,919 | 3,432 | 1.000 |
| Copilot CLI 1.0.105 | `gpt-6.1-sol` | `.github/copilot-instructions.md` | 22,129 → 25,561 | 22,129 → 25,559 | 3,431 | 1.000 |
| Copilot CLI 1.0.105 | Claude Sonnet 5.5 (`claude-sonnet-5.5`) | same | 36,468 → 41,976 | 36,482 → 41,978 | 5,502 | 1.603 |
| Copilot CLI 1.0.105 | Claude Opus 5.5 (`claude-opus-5.5`) | same | 36,138 → 41,633 | 36,138 → 41,631 | 5,494 | 1.601 |
| Claude Code 2.1.318 (terminal, `--strict-mcp-config`) | Claude Opus 5.5 (`claude-opus-5-5`, the default) | `CLAUDE.md` | 44,192 → 49,668 | 44,189 → 49,668 | 5,478 | 1.596 |
| Claude Code 2.1.318 (terminal, `--strict-mcp-config`) | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | same | 44,146 → 49,618 | 44,147 → 49,616 | 5,471 | 1.594 |
| Copilot Chat in VS Code | — | — | not measured: no command-line mode | — | — | — |

What this shows:
- **OpenAI's encoding is confirmed for `gpt-6.1-sol`.** Two agents gave exactly the `o200k_base` count, which OpenAI's documentation does not state.
- **Copilot CLI adds the file once.** With an OpenAI model it adds the file's exact token count and nothing more.
- **Claude Opus 5.5 and Claude Sonnet 5.5 count this text at 1.59–1.60 times `o200k_base`, in both agents.**
  - The two models agree within 8 tokens, as expected from Anthropic's statement that Claude 4.7 and later share one tokenizer.
  - Claude Code counts the same file 16–31 tokens lower than Copilot CLI does with the same model (0.3–0.6%). The likely cause: Claude Code strips block-level HTML comments from `CLAUDE.md` before the model sees it, per its memory docs. The files contain one, `<!-- code-review-graph MCP tools -->`. This was not measured separately.
- **Claude Code's claude.ai connectors made the first runs unusable.** Without `--strict-mcp-config`, the connected claude.ai MCP servers (Atlassian Rovo, Lovable, Claude Docs and others) were present in some sessions and missing in others. That moved the base context by about 4,000 tokens between runs: 48,737 against 44,555 for Opus. With `--strict-mcp-config` and no `--mcp-config`, no MCP server loads, and every pair repeated within 3 tokens.
- **Copilot Chat in VS Code is not measured.** It uses the same models as Copilot CLI, so its file sizes should match the Copilot CLI rows. Its own wrapping is unmeasured.

**Level 2.** Each clause's `o200k_base` count from section 4, multiplied by the ratio measured for each agent and model. The ratio is an average over the whole text; a single clause can differ, so the Claude columns are estimates.

| Home (section 4) | `gpt-6.1-sol` (Codex CLI, Copilot CLI), exact | Claude Opus 5.5 in Claude Code (× 1.596) | Claude Sonnet 5.5 in Claude Code (× 1.594) | Claude Opus 5.5 in Copilot CLI (× 1.601) | Claude Sonnet 5.5 in Copilot CLI (× 1.603) |
|---|---:|---:|---:|---:|---:|
| Clauses that become triggers (whole clause today) | 1,821 | 2,907 | 2,903 | 2,915 | 2,919 |
| Core | 579 | 924 | 923 | 927 | 928 |
| References | 498 | 795 | 794 | 797 | 798 |
| Maintainer notes (`codex/AGENTS.md`) | 330 | 527 | 526 | 528 | 529 |
| Skills | 230 | 367 | 367 | 368 | 369 |
| VS Code's lessons file (VS-1) | 206 | 329 | 328 | 330 | 330 |
| agent-config-only rules | 197 | 314 | 314 | 315 | 316 |
| Drop or merge | 152 | 243 | 242 | 243 | 244 |
| Codex pointer list (replaced by D2) | 100 | 160 | 159 | 160 | 160 |

Estimated size of the new core, every agent:
- **Kept clauses: about 411 `o200k_base` tokens.** That is the core rows with the two shortenings section 4 proposes, plus the full `default` pattern (D3), plus 46 more in Claude Code for its `@` import line.
- **One line per trigger: about 385.**
- **Total: about 800 `o200k_base` tokens.** That is 800 for `gpt-6.1-sol` and about 1,280 for Claude Opus 5.5 or Claude Sonnet 5.5.

| Agent | Model | Three files today (measured) | Estimated core | Estimated saving per model request |
|---|---|---:|---:|---:|
| Codex CLI | `gpt-6.1-sol` | 3,432, plus the extra request that reads them (section 5) | about 800 | about 2,632 |
| Copilot CLI (and VS Code, same model) | `gpt-6.1-sol` | 3,431 | about 800 | about 2,631 |
| Copilot CLI (and VS Code, same model) | Claude Sonnet 5.5 (`claude-sonnet-5.5`) | 5,502 | about 1,283 | about 4,219 |
| Copilot CLI (and VS Code, same model) | Claude Opus 5.5 (`claude-opus-5.5`) | 5,494 | about 1,281 | about 4,213 |
| Claude Code | Claude Opus 5.5 (`claude-opus-5-5`, the default) | 5,478 | about 1,277 | about 4,201 |
| Claude Code | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | 5,471 | about 1,275 | about 4,196 |

Every model request in a session sends the instructions again, so the saving repeats on each request, in cached or uncached form. Level 3 (section 6.2) measures whole sessions.

### 6.2 Level 3 results, 2026-11-09

**Setup.** Variant A is today's instructions. Variant C is the candidate built from the answered decisions:
- a 915-token core (`o200k_base`);
- three references read on demand: the pattern library with the `deepdive` rules merged in (D4), the graph guide, and the SQL rules;
- `~/.codex/AGENTS.md` = the core itself (D2).

Each agent ran isolated from the live global instructions, and nothing in `~/.claude`, `~/.copilot` or `~/.codex` was edited:

| Agent | How the variant was swapped in |
|---|---|
| Claude Code | `claudeMdExcludes` skipped the user `CLAUDE.md`; the variant's text was the test project's `CLAUDE.md`, inline because `claude -p` skips imports from outside the project |
| Copilot CLI | A temporary `COPILOT_HOME` with a link to `config.json` and the variant in `instructions/` |
| Codex | A temporary `CODEX_HOME` with a link to `auth.json` and the variant as `AGENTS.md` |

`~/.copilot/references` was a temporary link to the test references during the run, so the core carried its deployed paths. The link was removed afterwards.

The test project was the handoff's fixture: a payments rule, a review sample, and code to search. There were 8 prompts, each run twice per variant, alternating A and C. All 96 sessions exited normally.

**Behavior.** Each answer was checked automatically for the greeting, the required headings or facts, and the right result, then read wherever a check failed. Every check passed in both variants except:

| Check | A (today) | C (candidate) |
|---|---|---|
| Four default sections in the email answer (D3) | Missing in 5 of 6 (Copilot CLI included them once) | Missing in 5 of 6 (Claude Code included them once) |
| Four default sections in ordinary questions (payments rule, find the caller, `{{AGENT_HOME}}` path) | Claude Code 4/6, Copilot CLI 1/6, Codex 0/6 | Claude Code 6/6, Copilot CLI 3/6, Codex 0/6 |
| `pattern:bugfix` headings | Copilot CLI wrote "Verification" instead of "Verification Steps" once | All present |
| Deep dive marks verified claims | Codex skipped it once | All present |

The candidate behaved at least as well as today's instructions. Today's instructions don't get the four default sections applied to an email either (see D13).

**Cost.** Totals over 16 sessions per variant:

| Agent and model | Input tokens, cache included (A → C) | Cache writes | Model calls | Billing measure | Median seconds |
|---|---:|---:|---:|---:|---:|
| Codex CLI, `gpt-6.1-sol` | 1,699,434 → 1,270,508 (−25.2%) | 0 → 0 | not reported | not reported | 19.95 → 19.75 |
| Copilot CLI, Claude Sonnet 5.5 | 1,001,872 → 944,530 (−5.7%) | 310,118 → 185,839 (−40.1%) | 28 → 34 | 93.35 → 63.59 AI credits (−31.9%) | 10.75 → 11.25 |
| Claude Code, Claude Opus 5.5 | 2,035,751 → 2,029,821 (−0.3%) | 309,179 → 289,272 (−6.4%) | 43 → 47 | $3.224 → $3.085 Claude Code list-price estimate (−4.3%) | 17.1 → 19.3 |

Where the difference comes from, per prompt (input, A → C):

| Prompt | Codex CLI, `gpt-6.1-sol` | Copilot CLI, Claude Sonnet 5.5 | Claude Code, Claude Opus 5.5 |
|---|---:|---:|---:|
| Email | −54.0% | −22.8% | −8.8% |
| `pattern:bugfix` | −29.1% | +57.1% (1 → 2 calls) | +8.2% |
| Unknown tag `pattern:haiku` | −39.8% | +56.5% (1 → 2 calls) | +83.5% (1 → 2 calls) |
| Deep dive | −22.7% | +56.8% (1 → 2 calls) | +89.1% (1 → 2 calls) |
| Payments rule | −3.9% | −22.7% | −8.8% |
| Doc review | −16.8% | −22.5% | +6.2% |
| Find the caller (no graph) | −22.0% | −22.5% | +23.8% (C read the graph guide once) |
| `{{AGENT_HOME}}` path | −39.4% | −22.3% | −43.9% (A explored for 8 calls once) |

What this shows:
- **Each request is cheaper, as levels 1 and 2 predicted.** Claude Code's email used one request in both variants: 46,068 → 42,000 tokens, a saving of 4,068 against the 4,201 estimated in section 6.1.
- **A file read on demand costs a whole extra model request.**
  - When a prompt needs the pattern library, Copilot CLI and Claude Code make one more call. That call sends the whole context again: about 20,000 tokens in Copilot CLI and about 41,000 in Claude Code.
  - Codex already read every file under today's setup, so there it saved on every prompt.
  - In Copilot CLI the extra calls were still cheaper in AI credits (−17% to −27%), because the context is cached. In Claude Code they cancel the saving: total input fell 0.3%.
- **The graph trigger fires without a graph.** With no code-review-graph index, the candidate made Claude Code (once) and Codex read the graph guide anyway (D12).
- **Not covered:**
  - Copilot Chat in VS Code, which has no command-line mode.
  - The three skills from D6, not built yet; they would add about 150 tokens to the skill list.
  - Your MCP servers, which were left out of both variants.
  - Claude Code's output tokens: its stream lines carry placeholders, so its output column is not reliable. Its cost estimate comes from the final result.

### 6.3 Re-run with D11–D13, 2026-11-09

**Setup.** The candidate core was revised as V answered:
- **D11 (b):** the default layout inline, the rest of the pattern library on demand.
- **D12:** the graph trigger keyed to the tools being available.
- **D13:** the layout named for "every response, including drafts, emails and short answers".
- **Also added:** a trigger to read `instruction-wording-findings.md` before changing instructions, which was added to today's `personal-defaults.instructions.md` too.

That makes the core 1,013 `o200k_base` tokens. Same isolation and test project as section 6.2. Four prompts (email, find the caller, payments rule, `{{AGENT_HOME}}` path), today's instructions (A) against the revised candidate (C2), two runs each, 48 sessions. All exited normally.

| Agent and model | Four sections, email (A → C2) | Four sections, ordinary questions | Graph guide read with no graph | Input tokens, cache included | Billing measure |
|---|---|---|---|---:|---:|
| Claude Code, Claude Opus 5.5 | 0/2 → 2/2 | 4/6 → 6/6 | 0/2 → 0/2 | 1,226,318 → 1,083,003 (−11.7%) | $1.878 → $1.522 list-price estimate (−19.0%) |
| Copilot CLI, Claude Sonnet 5.5 | 0/2 → 2/2 | 2/6 → 5/6 | 0/2 → 0/2 | 577,454 → 449,904 (−22.1%) | 51.54 → 31.06 AI credits (−39.7%) |
| Codex CLI, `gpt-6.1-sol` | 0/2 → 2/2 | 0/6 → 6/6 | 2/2 → 0/2 | 805,846 → 613,074 (−23.9%) | not reported |

What this shows:
- **D13's wording works in all three agents:** 23 of 24 answers used the layout, against 6 of 24 with today's wording. Codex went from 0 to 8 of 8. Output barely moved: Copilot CLI +1%, Codex −19%.
- **D12's wording stops the needless reads:** 0 of 6, against 3 of 6 with the first candidate wording.
- **Every agent saved on these prompts**, Claude Code included (−11.7% input), because none of them needs the pattern library. The library still costs one extra request when a non-default tag or a deep-dive phrase is used (section 6.2).
- Greeting 48/48; the caller found 12/12.

The wording findings are recorded in `copilot/knowledge/ai-agents/instruction-wording-findings.md` (IW-11, IW-12).

### 6.4 Batched reads, 2026-11-09

**Question.** Can a core line make agents decide every file they need first, and read them all in one turn, to save model requests? V proposed this after section 6.3.

**Setup.** C2 is the revised core from section 6.3. C3 is the same core plus this line:

> Before your first tool call, work out every file this task needs: those named below, in the message, or in files you already know. Request them all in one turn, as parallel tool calls. Make another round only for paths you learn from what you just read.

The test used the five prompts that read files (`pattern:bugfix`, deep dive, payments rule, doc review, find the caller), two runs each, on the same three agents: 60 sessions, all exited normally.

| Agent and model | Input tokens (C2 → C3) | Model requests | Billing measure |
|---|---:|---:|---:|
| Claude Code, Claude Opus 5.5 | 1,492,025 → 1,241,999 (−16.8%) | 34 → 28 | $2.230 → $2.166 list-price estimate (−2.9%) |
| Copilot CLI, Claude Sonnet 5.5 | 730,035 → 710,719 (−2.6%) | 26 → 25 | 48.43 → 45.94 AI credits (−5.1%) |
| Codex CLI, `gpt-6.1-sol` | 974,840 → 881,477 (−9.6%) | not reported (shell commands 28 → 34) | not reported |

What this shows:
- **The same files were read and the answers passed the same checks.** The one failed check, in the payments rule prompt, failed in both variants. Read by hand, both answers state the check ("does not charge … twice").
- **Claude Code gained most.** It made one request fewer in 6 of its 10 sessions: payments rule 2, doc review 2, find the caller 1, `pattern:bugfix` 1. Each saved request is worth about 40,000–45,000 input tokens.
- **The first read cannot be batched away.** The deep dive still made two requests in both variants: one to read the pattern file, one to answer.
- **Decision.** V asked to deploy if nothing needed asking. The line helped on every agent, so it was added to the deployed core (D14).

## 7. Findings from the inventory

| ID | Finding | Rows |
|---|---|---|
| F1 | **Duplicates.** The same rule is stated twice: pattern summaries (PD-4 and `patterns/index.md`); References and Related (PD-26 and the knowledge schema rule KB-12); the tracker usage line (PD-18 and the hook's own text); abbreviations (PD-23 and the no-shorthand checklist); PD-29 inside PD-28 | PD-4, PD-18, PD-23, PD-26, PD-29 |
| F2 | **Two definitions of "deep dive".** PD-31 requires five elements; the `deepdive` pattern (AP-4) gives four different headings. A message with both "pattern:deepdive" and "deep dive" has no single answer | PD-31, AP-4 |
| F3 | **Rules only for agent-config sit in the global file.** Installer backups, review-docs before commit and the knowledge-writing rules apply only when working on this repo. agent-config has no root `AGENTS.md` or `CLAUDE.md` today | PD-2, PD-5, PD-19 |
| F4 | **Maintainer text reaches the model.** About 330 tokens of notes and references in `codex/AGENTS.md` load in every Codex session | EP-2 |
| F5 | **For Codex, a pointer costs more than inline text** (section 5) | EP-1 |
| F6 | **The default answer layout would change.** Today the default has four sections; the benchmark's reduced core let Copilot drop them for an email. Whether that is wanted is V's preference, not a token question | AP-1 |
| F7 | **The largest optional inputs are outside the three files.** The tracker hook (1,245 tokens here) and the skill list (about 980) together are close to the whole personal-defaults file | OS-1, OS-2 |
| F8 | **One agent loads a file the others never see.** VS Code also loads `copilot-lessons.instructions.md` from its own settings folder, outside this repo | VS-1 |
| F9 | **The evidence covers two agents of four.** The benchmark ran Codex and Copilot CLI. Claude Code and Copilot Chat in VS Code have no measurements yet, and all counts so far use OpenAI's tokenizer | — |

**Estimated core** (CORE rows plus one line per TRIG row): about 700–900 tokens, against 3,431 today. This is an estimate from the rows above. Step 2 measures the real number.

## 8. Decisions

| # | Question | Options | Recommended | V's answer (2026-11-09) | Lands in |
|---|---|---|---|---|---|
| D1 | Where does the core live, and where do the references go? | (a) One `copilot/instructions/core.instructions.md`; move the pattern library and graph guide out of `copilot/instructions/`, because Copilot loads everything there. (b) Keep three files and only shorten them | (a): the handoff found that a reference Copilot still discovers by itself saves nothing | "D1 -> a" | `copilot/instructions/`, a new references folder, `mapping.yaml` |
| D2 | How does Codex get the core? Claude Code and Copilot load files natively, so Codex is the only agent that needs a new mechanism | (a) `mapping.yaml` links `~/.codex/AGENTS.md` straight to the core file: one copy, 21 tokens of front matter read as text. (b) Codex keeps a pointer file. (c) Generate a copy at install | (a): no extra model request (F5) and one canonical copy | "For D2, use option linking mapping (a)." | `mapping.yaml`, `codex/AGENTS.md` (removed or emptied) |
| D3 | Default answer layout | (a) Always four sections (today). (b) Answer first; add rationale, caveats and next steps when useful, in that order | V's preference. (b) is what was measured | "D3 uses A." The core keeps today's `default` pattern (AP-1) unchanged, so step 2 re-measures the reduced core with the four sections | Core, AP-1 |
| D4 | One definition of "deep dive" | (a) Merge PD-31's five requirements into the `deepdive` pattern, and let the trigger phrases route to it. (b) Keep both | (a) | "D4 -> a" | Pattern library |
| D5 | Rules only for agent-config | (a) Root `AGENTS.md` in agent-config, with `CLAUDE.md` importing it, holding PD-5 and the knowledge-writing rules, plus a one-line core trigger for review-docs (commits to the knowledge base can come from a session started in another folder). (b) Leave them global | (a) | "D5 -> a" | agent-config `AGENTS.md`, `CLAUDE.md`, core |
| D6 | Rare workflows (Spec Kit, GitHub governance, team doc) | (a) Thin skills pointing to the procedures (the "Shared Procedure + Thin Wrapper" pattern). (b) One-line core triggers | (a): all three tools discover skills; costs about 50 tokens each in the skill list | "D6 -> a (but if B, what will it look like?)": (a). What (b) looks like is under the table | `skills/` |
| D7 | Inline `bugfix` headings for Copilot | Test first (handoff step 3) | No decision until measured | Waits on the measurement in step 3 | — |
| D8 | Maintainer notes in entry files | Move them to a README beside the file | Move | "D8 -> ok" | `codex/README.md` |
| D9 | Tracker hook and skill list size | (a) Track separately: cap the hook's list, scope the `sdlc-*` skills. (b) Leave as is | (a), as its own item | "D9 -> a" | `TRACKER.md` |
| D10 | Where does VS Code's `copilot-lessons.instructions.md` go? | (a) Move its rules into this repo and inventory them like the rest, so every agent gets them. (b) Leave it VS Code-only | (a): its rules come from real mistakes, which apply to every agent | "D10 -> ignore (note, deal later)": deferred; VS-1 stays VS Code-only for now, tracked in `TRACKER.md` | Core or references |
| D11 | Pattern library: read on demand or inline? Level 3 shows that one read costs a whole extra model request: about 41,000 input tokens in Claude Code and about 20,000 in Copilot CLI | (a) Inline the library in the core: about 420 `o200k_base` tokens (about 670 for Claude Opus 5.5 or Claude Sonnet 5.5) on every request. (b) Keep it on demand (today's candidate) | (a) if tagged messages are more than about 1 in 60 requests in Claude Code or 1 in 30 in Copilot CLI; otherwise (b). Measure how often V uses tags | "I actually rarely mention them directly by tag … inlining them is ok, but only the default pattern … we keep a link to the pattern library file with a trigger wording so AI models only read it when I mention the tag directly that's not the default": (b), with the default layout inline in the core and the library read only for a non-default `pattern:` tag or a deep-dive phrase. This replaces the earlier "D11 ok" | Core, references |
| D12 | Graph trigger wording | (a) "Only when code-review-graph tools are available in this session", so agents stop reading the guide in repos without a graph. (b) Keep it | (a) | "For D11, D12 ok": (a) | Core |
| D13 | The four default sections were missing from email answers in 10 of 12 runs, and from Codex's ordinary answers in 12 of 12, under today's instructions and the candidate alike | (a) Strengthen the wording ("every response, including drafts and short answers") and re-test; adds output tokens. (b) Accept the default as a guide, not a rule, for drafts | V's preference | "For now D13, use that strong wording": (a). Candidate wording: "Use this layout for every response, including drafts, emails and short answers, unless a `pattern:` tag says otherwise" | Core, AP-1 |
| D14 | Ask agents to plan and batch their file reads? | (a) Add the batching line (section 6.4). (b) Leave it out | (a): fewer requests in all three agents | "Then deploy if nothing needed to ask me": (a), added after the test | Core |

**What D6 (b) would have looked like.** Each rare workflow stays a line in the core, shortened, and no skill is added. For example:

```markdown
- Setting up Spec Kit: follow `~/.copilot/procedures/spec-driven-development.procedure.md`.
- Adding GitHub governance files: follow `~/.copilot/procedures/init-github-governance.procedure.md`.
- A doc for V's team: follow `~/.copilot/knowledge/documentation/doc-template-base.md`.
```

The two options cost about the same at session start: about 30 tokens per line in (b), about 50 per skill-list entry in (a). They differ in how the workflow is found:
- **(b):** works in any agent that reads the core, but only when the model notices the line.
- **(a):** gives each workflow a name that can be called directly (for example `/spec-kit-setup`) and a description the agent matches against the task, in every agent that reads `skills/`.

## 9. What step 2 must test

These are the regression cases for the clauses above, in addition to the handoff's five prompts. Every case runs on all four agents in section 2, each with the model it normally uses, and is counted with the method in section 6.

| Case | Checks that |
|---|---|
| Ordinary question | PD-15 greeting; PD-6 to PD-14 style; D3: all four default sections present |
| `pattern:decision` and an unknown tag `pattern:foo` | AP-0 stripping and fallback |
| "Deep dive on X" | D4 routing and all five elements |
| Doc with `{{AGENT_HOME}}` | PD-1: the variable is resolved, not guessed |
| Question about an OTS repo | PD-3: `companies/ots/index.md` is read first |
| Turn that leaves work undone in a repo with `TRACKER.md` | PD-18: an item is added with the tool |
| Commit under `copilot/knowledge` from a session started outside agent-config | D5: review-docs still runs |
| A measured fact | PD-28: recorded with version and date |
| Indexed repo, then a repo with no graph | CRG-0: graph first, then the fallback |

## References

**Local artifacts:**
- `copilot/instructions/*.instructions.md`, `codex/AGENTS.md`, `claude/CLAUDE.md`, `mapping.yaml`: the files inventoried.
- `copilot/tracker/tracker.mjs` (`--hook`) and `skills/*/SKILL.md`: the other session-start inputs (OS-1, OS-2).
- `~/Documents/Codex/2026-11-06/referenced-chatgpt-conversation-this-is-an/outputs/graph-instructions-handoff.md` and `cli-instructions-benchmark.csv`: the handoff and the benchmark.
- `copilot/knowledge/ai-agents/codex-usage-reference.md`, section "Global instructions that point to other files": the Codex finding.
- `copilot/knowledge/ai-agents/tokenizers-for-coding-agents.md`: the official tokenizer and count endpoint for each vendor, behind section 6.
- `copilot/patterns/shared-procedure-thin-wrapper.pattern.md`: the skill shape behind D6.

**External authoritative sources:**
- [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md): how Codex discovers `AGENTS.md`.
- [Claude Code memory](https://code.claude.com/docs/en/memory): `CLAUDE.md` and `@` imports.
- [Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference): Copilot CLI instructions.
- [Agent Skills specification](https://agentskills.io/specification): the shared skill format.

## Related

- `proposals/README.md`: the proposal lifecycle and where each decision lands.
- `copilot/knowledge/ai-agents/skills-delegation-cache-economics.md`: why fewer loaded tokens and cached tokens are different savings.
- `copilot/knowledge/ai-agents/agent-skills-portability.md`: how skills load in each tool.
