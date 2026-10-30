# Charter vs agent-role, and what a "floor" really is

> Answers two questions about [agent-foundry-architecture.md](agent-foundry-architecture.md). Evidence checked 2026-10-24 in `copilot/frameworks/agentic-sdlc/`. Nothing implemented.

## Q1. Modify `agent-role/v2`, or create a new schema that inherits from it?

**Recommendation: a new `charter/v1` schema, owned by the Foundry. Leave `agent-role/v2` untouched. "Inherit" by reference, not by editing.**

### Evidence that editing `agent-role/v2` would not work

| Fact in the repo | Where | Consequence |
|---|---|---|
| The validator only checks roles **registered in `conventions.md` §1**, and requires `schema === 'agent-role/v2'` and `id` equal to the registered id | `tools/validate.mjs` lines 366-371 | A `pr-reviewer` is not an SDLC role. It would have to be registered as one, or it would not be checked at all |
| Front-matter requires `phases` (P1 to P7) and `model-tier` | `schemas/agent-role.schema.md` | These are SDLC-workflow terms. A PR reviewer has no phase |
| Preset knowledge may list **only `foundations/` paths** | schema Rules + validator line 380 | A Foundry agent also needs facts, references and a Lens, which are not foundations |
| Roles are launched only by the **Orchestrator** | `conventions.md` §2.1 | A Foundry agent runs standalone, e.g. in a PR bot |
| The schema system has **no inheritance mechanism** (searched `_system.md` for inherit / extends / superset: no hits) | `schemas/_system.md` | "Inherits from" cannot be enforced; it can only be a documented reference |
| Making Foundry depend on editing agentic-sdlc schemas | n/a | Recreates the tight coupling you asked to remove (see [loose-coupling-backplane.md](loose-coupling-backplane.md)) |

### The three options compared

| Option | What it means | Verdict |
|---|---|---|
| **A. Edit `agent-role/v2`** | Add optional sections (Lens, Autonomy, Eval) to the existing schema | Works technically, but couples the Foundry to the SDLC framework and drags SDLC-only fields (phases, tier) onto every agent |
| **B. New `charter/v1`, copies the shared sections** | Foundry has its own schema; it **reuses the same section names** (Identity, Does NOT do, Modes, Review rubric, Escalate when, Output) | **Recommended.** Independent, and later easy to align |
| **C. Make the SDLC roles Charters too** | Migrate the nine roles to `charter/v1` | Good end state, but a separate migration. Do it only after B works |

### What the Charter reuses vs adds

```text
agent-role/v2 sections                        charter/v1
─────────────────────                         ──────────────────────────────
Identity                              ──────► Identity                    (same meaning)
Does NOT do                           ──────► Does NOT do                 (same)
Preset knowledge  (foundations/ only) ──────► Knowledge bindings          CHANGED: rules + references + facts, by name
Runtime inputs                        ──────► Runtime inputs              (same)
Trees owned                           ──────► Decision flow               (same: trees, Default + Escalate when)
Modes                                 ──────► Modes                       (same)
Review rubric  (Id, Check, Enforced   ──────► Review rubric              (same table, now also the home of severities)
   by, Severity if failed)
Standalone use                        ──────► Standalone use              (same)
Escalate when                         ──────► Escalate when               (same)
Output  (message/v2)                  ──────► Output                      (same)
front-matter: phases, tier, tag       ──────► REMOVED (SDLC-only)
                                              Lens scopes                 NEW
                                              Floors                      NEW (reference to the floors registry)
                                              Autonomy level              NEW
                                              Eval set                    NEW
```

So nothing is reinvented: 10 of the sections are copied by name and meaning; 4 are new; 3 SDLC-only fields are dropped.

## Q2. What is a "floor"?

### 2.1 Short answer

A **floor is a label on a rule that says "no team preference may lower or waive this."** It is **not** a place, not a layer of files, and not the knowledge home.

Your question: "does floor mean the principles/rules like foundations in the knowledge home?" Two corrections, and one thing you got right:

| Your reading | Reality |
|---|---|
| Floors are the rules in foundations | **Partly right.** Floors are a *small subset* of the foundation rules. Most foundation rules are not floors |
| In "the knowledge home" | **No.** Foundations live in store **A** (`frameworks/agentic-sdlc/foundations/`). The knowledge home is store **B** (`knowledge/`), which holds explanations, not rules |

I made this confusing: the earlier docs show "L0 Principles + Floors" and "L1 Rules" as two layers, but **in the repo both would live in `foundations/`**. The split is a *tag*, not a folder. Simplest honest picture:

```text
STORE A  foundations/            ALL universal rules (ERR-1..12, DS-1..12, CON-1..12, Q-SEC-*, …)
            │
            │   tag a few of them as "floor"
            ▼
         ┌─────────────────────────────┐
         │ floor: cannot be lowered or │   e.g. Q-SEC-5 (no secrets)
         │ waived by any Lens          │        ERR-5 (fail closed)
         └─────────────────────────────┘        CON-9 (no breaking change)
            all other rules: a team Lens MAY lower severity one step or add a waiver
```

So I suggest **dropping "L0" as a separate layer**. Layers become: **Rules** (some are floors) · **Facts** · **Lens** · **Task state**.

### 2.2 Why a floor tag is needed (nothing marks it today)

I checked how rules and severities are stored:

| Where | What it holds | Has severity? |
|---|---|---|
| Foundation rule table: `Id, Rule, Holds when, Typical violation, Enforced by, Source` | The rule itself | **No** |
| Role **Review rubric**: `Id, Check, Enforced by, Severity if failed` | How *one role* grades a violation | **Yes** (e.g. ENG-R5 secrets = `blocker`, ENG-R2 swallowed errors = `major`) |
| `review-rubrics.md` | The severity scale `blocker > major > minor > nit` | Scale only |

Two consequences:

1. **Severity belongs to a reviewer's rubric, not to the rule.** In my worked example I wrote "ERR-2 base severity: major". That was imprecise. The `major` comes from the engineering role's rubric row ENG-R2. A Foundry `pr-reviewer` Charter would carry its **own** rubric rows that map rules to severities. The worked example has been corrected.
2. **Nothing says which rules are untouchable.** The validator would accept a Lens entry that lowers a secrets rule, because no rule is marked as a floor.

### 2.3 Where to put the tag: two options

| Option | How | Pros | Cons |
|---|---|---|---|
| **1. New `Floor` column in every foundation rule table** | Add a column; bump `foundation/v2` to v3 | The flag sits next to the rule | Edits ~20 files, changes a shared schema, couples policy to the rules |
| **2. A separate registry file** (recommended) | One file, `floors.md`, in the Foundry listing rule ids and a reason; validator checks the ids exist | No rule files change. The policy "what is untouchable" is stated in one reviewable place | Registry can drift from the rules (the validator closes this: unknown id = error) |

Sketch of option 2:

```markdown
# Floors (rules no Lens may lower or waive)

| Rule | Why it is a floor | Category |
|---|---|---|
| Q-SEC-5 | A leaked secret cannot be un-leaked | security |
| Q-SEC-8 | Fail-open in auth/validation is exploitable | security |
| ERR-5   | Payment, auth and validation paths must fail closed | data integrity |
| CON-9   | Breaking a published contract hurts consumers outside the team | contract |
| RUB-3   | Must not contradict the constitution / accepted decisions / frozen contract | governance |
| RUB-5   | No secrets, credentials or personal data in the artifact | security |
```

Rule of thumb for adding a floor: **harm lands on people outside the team, or cannot be undone.** Anything that is only style, taste, or internal maintainability is *not* a floor.

### 2.4 Worked mini-example

A team proposes two Lens entries:

| Proposed entry | Rule | Is it a floor? | Result |
|---|---|---|---|
| "Accept swallowed errors in `src/legacy/**`" | ERR-2 | No (not in `floors.md`) | Allowed: reviewer severity `major` becomes `minor` |
| "Accept swallowed errors in `src/payments/**`" | ERR-5 (fail closed in payment path) | **Yes** | Rejected at the promotion gate, even if every teammate agrees |

Note both entries are about "errors"; the **floor tag, not the topic,** decides. This is why a registry with a one-line reason per rule is better than a vague "security things are protected".

## Q3. Next steps (smallest first)

1. Write `floors.md` (6 rules above, to be reviewed by you).
2. Define `charter/v1` in a new `copilot/frameworks/foundry/` folder, with the section mapping in Q1.
3. Add a Foundry validator: Charter sections present, every floor id exists, Lens entries never touch a floor.
4. Leave `agent-role/v2` and the nine SDLC roles unchanged.

## Not verified

- Whether extra columns in a foundation rule table would pass the validator: it requires four columns to exist (line 206) and I saw no check against extras, but I did not run it. Moot if option 2 is chosen.
- The floor set is a proposal from reading rule titles. Review each rule's full text before adopting it.
