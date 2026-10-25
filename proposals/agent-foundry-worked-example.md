# Agent Foundry: one worked example, start to finish

> Companion to [agent-foundry-architecture.md](agent-foundry-architecture.md). That file defines the parts; this file shows each part working on **one invented story**.
> Everything below is made up for illustration (team, repo, PR numbers, counts). Rule ids (ERR-2, DS-2, DDD-5, CA-4, Q-SEC-5, Q-SEC-8, CON-9) are **real** and were checked against `copilot/frameworks/agentic-sdlc/foundations/`.
> Numbers such as "3 signals" or "90 days" are starting guesses, not measured values.

## 0. The story

| Item | Value |
|---|---|
| Team | **Orders team** (4 people: Mai, Tuan, Lan, Huy) |
| Repo | `shop-orders` (the Orders team owns it) |
| Legacy code | `vendor/legacy-tax-client/`: a tax library owned by **Finance Platform**, another team. The Orders team may call it but may not change it |
| The PR | **#512 "Add refund endpoint"**, opened by Mai |
| The agent | `pr-reviewer`, built by the Foundry from a Charter |

Files touched by PR #512:

```text
shop-orders/
├── src/refunds/refund_controller.ts      NEW   (Orders team code)
├── src/refunds/refund_service.ts         NEW   (Orders team code)
├── src/refunds/tax_adapter.ts            NEW   (Orders team code, calls the legacy tax library)
├── src/orders/order_repository.ts        EDIT  (older Orders code, known debt)
└── vendor/legacy-tax-client/…            NOT TOUCHED, but called through tax_adapter.ts
```

## 1. The layers, with an example of each

Think of the layers as **five folders of "things the agent may need to know"**, ordered from "never changes" to "only this PR".

| Layer | Plain meaning | What it holds **for PR #512** | Where it lives today |
|---|---|---|---|
| **L0 Principles + Floors** | Things that are never negotiable | "Never log secrets" (Q-SEC-5). "An error in a payment path must deny, not allow" (Q-SEC-8, ERR-5). "Do not break an existing API contract" (CON-9) | `foundations/quality/security.md`, `error-handling.md`, `contract-design.md` |
| **L1 Rules + References** | Industry best practice, written as numbered rules | "Every remote call has a timeout" (DS-2). "Never swallow an error" (ERR-2). "Translate at the border with an anti-corruption layer" (DDD-5) | `foundations/…`, `knowledge/…` |
| **L2 Facts** | True things about this company and repo | "`shop-orders` is owned by Orders team." "`vendor/legacy-tax-client` is owned by Finance Platform." "`POST /refunds` is a new endpoint." | `companies/<co>/…`, repo `docs/` |
| **L3 Lens** | What *this team* has decided it accepts or prefers | "In `order_repository.ts` the team accepts one swallowed error, because the fix is scheduled." "The team wants refund amounts as integer cents." | **New.** Not in the repo yet |
| **L4 Task state** | Only this PR | The diff, the PR description, the spec for refunds, comments already made | The PR itself |

The key idea: **L0 and L1 are the same for every team on Earth. L2 is about one company. L3 is about one team. L4 is about one PR.** A normal AI reviewer only has L4 and a vague memory of L1. The Foundry adds L2 and L3 in an organised way.

## 2. The Resolver: one ordered Context Pack

**Problem it solves:** before reviewing, the agent must decide *which* of hundreds of rules and facts matter for *this* PR, and *what wins if two disagree*.

### 2.1 Input and output

```text
INPUT   Charter (pr-reviewer) + PR #512 + the zone of each file
          │
          ▼
        RESOLVER
          1. select   : which items apply (by path, topic, team)
          2. order    : strongest layer first
          3. resolve  : apply rules R1..R7 when two items disagree
          4. bound    : cut to a size budget (never cut L0)
          │
          ▼
OUTPUT  Context Pack (ordered list, every item says where it came from)
```

### 2.2 A real-looking Context Pack for PR #512

```yaml
context_pack:
  - { id: Q-SEC-5,  layer: L0, why: "diff adds config, check for secrets" }
  - { id: Q-SEC-8,  layer: L0, why: "refund is a payment path" }
  - { id: CON-9,    layer: L0, why: "new endpoint under existing /orders API" }
  - { id: DS-2,     layer: L1, why: "tax_adapter.ts makes a remote call" }
  - { id: DDD-5,    layer: L1, why: "domain code touches a foreign model" }
  - { id: ERR-2,    layer: L1, why: "diff contains try/catch" }
  - { id: ZONE-1,   layer: L2, why: "vendor/legacy-tax-client = foreign, owner Finance Platform" }
  - { id: LS-007,   layer: L3, scope: "team:orders", why: "amounts as integer cents" }
  - { id: LS-014,   layer: L3, scope: "path:src/orders/order_repository.ts", why: "accepted swallowed error" }
  - { id: PR-512,   layer: L4, why: "the diff itself" }
dropped:
  - { id: DDD-8, reason: "no aggregate changed in this PR" }
  - { id: DS-6,  reason: "no event published in this PR" }
```

Notice what the Resolver did: it **selected 9 relevant items out of hundreds**, and wrote down why. Every later finding can point back to one of these ids. This is the "every item records where it came from" part.

### 2.3 Conflict example (what "resolve" means)

Two items disagree about `order_repository.ts`:

| Item | Says |
|---|---|
| L1 ERR-2 + the reviewer's own rubric | "Never swallow errors." The reviewer's rubric rates it **major** (severity lives in the reviewer's rubric, like ENG-R2, not in the rule table) |
| L3 LS-014 | "In this file, the team accepts a swallowed error until ticket ORD-88 is done" |

Resolver rule R3 (Lens may lower severity one step on an L1 rule) applies, so the result is **ERR-2 at `minor` for this file**, with both ids recorded. If instead the swallowed error were inside the payment path, ERR-5 (fail closed, an L0 floor) would apply and R1 says the Lens cannot touch it, so it stays `blocker`.

## 3. Lens limits: what the Lens may and may not do

The Lens is powerful (it shapes what the agent says) so it has a hard boundary: **it can tune the team's taste, never the safety floor.**

Six attempts a team might make, and the verdict:

| # | Lens entry someone proposes | Verdict | Why |
|---|---|---|---|
| 1 | "In `src/legacy/**`, treat ERR-2 (swallowed errors) as minor, not major" | **Allowed** (lower one step) | ERR-2 is an L1 rule, not a floor |
| 2 | "We never use inheritance deeper than 2, add a check" | **Allowed** (add a check) | Adds a team rule on top |
| 3 | "Amounts are integer cents, flag floats" | **Allowed** (add a check) | Team convention |
| 4 | "Accept the missing timeout in `tax_adapter.ts` until Q1" | **Allowed** (waiver, with an expiry date and owner) | DS-2 is L1; waivers are explicit and expire |
| 5 | "Ignore Q-SEC-5, our test fixtures contain real tokens" | **Rejected** | Q-SEC-5 is a floor (secrets) |
| 6 | "Skip contract checks for the internal refund API" | **Rejected** | CON-9 is a floor (contract break) |

"One step" means the severity ladder `blocker > major > minor > nit`. A Lens can move `major → minor`, never `major → nit`, and never `blocker → anything` on a floor rule.

> Note: today nothing in the repo marks a rule as a **floor**, and rule tables have no severity column (severity lives in each role's review rubric). A floor is a tag on a rule, not a separate layer; see [agent-foundry-charter-and-floors.md](agent-foundry-charter-and-floors.md). The set used here (Q-SEC-*, ERR-5, CON-9, RUB-3, RUB-5) is a proposal.
> In §1, read "L0 Principles + Floors" as "foundation rules that are tagged floors"; they live in the same `foundations/` folder as L1.

## 4. Legacy code: what the agent does and does not say

### 4.1 The code

`tax_adapter.ts` is **new code the Orders team wrote**. It calls a library nobody on the team may edit:

```ts
// src/refunds/tax_adapter.ts   (OWNED by Orders)
import { LegacyTaxClient } from '../../vendor/legacy-tax-client'; // FOREIGN: owned by Finance Platform

export async function refundTax(orderId: string, cents: number): Promise<number> {
  const client = new LegacyTaxClient();
  const result = client.calc(orderId, cents / 100);   // returns a loosely typed object, no timeout, throws strings
  return Math.round(result.tax * 100);
}
```

Inside the foreign library (the Orders team cannot fix any of this):

```js
// vendor/legacy-tax-client/index.js   (FOREIGN)
calc(id, amount) {            // no timeout, uses floats, throws strings, global state
  ...
}
```

### 4.2 Two reviewers, same PR

| | Naive AI reviewer | Foundry `pr-reviewer` |
|---|---|---|
| Looks at | Everything, including `vendor/legacy-tax-client/` | Zone map first: foreign = skip the inside |
| Says | "`calc` has no timeout, uses floats, throws strings, uses global state" ×4 | Nothing about the library's inside |
| Result | 4 comments the team can **never** act on; they learn to ignore the bot | Only comments the team can act on |

### 4.3 What the Foundry agent checks instead: **your side of the border**

```text
Orders code  ──►  tax_adapter.ts  ──►  LegacyTaxClient  (foreign, untouchable)
                  ▲ the border: this is what we review
```

| Boundary check | Rule | In PR #512 | Finding |
|---|---|---|---|
| Is the foreign call wrapped in an adapter? | DDD-5, CA-2 | Yes, `tax_adapter.ts` | pass |
| Does the adapter apply a timeout? | DS-2 | No | **finding** |
| Does it translate foreign errors (strings) into your errors? | ERR-4 | No, string throw escapes | **finding** |
| Do foreign types leak into the domain? | CA-4 | No, returns a plain number | pass |
| Are floats converted at the border? | LS-007 (team lens) | Uses `cents / 100` | **finding** (team wants cents all the way) |

Agent output, precise and fixable by the author:

```yaml
- rule: DS-2
  severity: major
  location: src/refunds/tax_adapter.ts:6
  provenance: [L1:DS-2, L2:ZONE-1 (foreign, owner Finance Platform)]
  detail: "Call to the foreign tax client has no timeout. We cannot change the client, so wrap this call in a 2s timeout here."
  confidence: high
```

### 4.4 A Waiver, because the team cannot fix everything today

Mai says: "We cannot add a timeout until the platform ships a client with `AbortSignal`. We will add it in Q1."

```markdown
## WV-003: No timeout on legacy tax client (temporary)
- **Zone:** owned (the adapter), which depends on the foreign `vendor/legacy-tax-client` (owner Finance Platform)
- **Rule waived:** DS-2 for `tax_adapter.ts` only
- **Reason:** library offers no cancellation hook; platform ticket FIN-210 open
- **Compensating control:** circuit breaker already around the call (FF dashboard "tax-latency")
- **Waiver owner:** Mai · **Review by:** 2027-01-31
- **After the date:** finding returns automatically
```

On the date, the finding comes back on its own. "Temporary" debt does not become permanent by forgetting.

## 5. Many reviewers: the agent as first-pass synthesiser

Reviewers Tuan, Lan and Huy also comment on PR #512. Raw material **before** the agent's synthesis:

| Source | Comment |
|---|---|
| Agent (raw) | A: missing timeout (DS-2) · B: string error not translated (ERR-4) · C: float conversion · D: variable `x` is a poor name · E: file has 220 lines · F: missing test for refund > order total · G: swallowed error in `order_repository.ts` |
| Tuan | "Missing timeout on the tax call" |
| Lan | "Please add a test for refunding more than was paid" |
| Huy | "Nit: rename `x`" |

### What the agent does, step by step

1. **Dedupe against humans.** A duplicates Tuan, F duplicates Lan, D duplicates Huy. The agent does **not** repeat them. It adds "+1, agent agrees" (A) or nothing.
2. **Rank.** Remaining: B (major), C (minor, team lens), G (minor after LS-014), E (nit).
3. **Cap noise.** The Charter says "max 5 new comments, nits omitted unless asked" (review-rubrics: nits are optional). E is dropped.
4. **Label by layer.** So the author knows whether to argue or just fix.
5. **Post one summary.**

```text
Agent summary for PR #512 (first pass; reviewers decide)

Already raised by reviewers: timeout (Tuan), over-refund test (Lan), rename x (Huy). Agent agrees.

New:
  [major] [best practice ERR-4]  tax_adapter.ts:9  foreign errors are strings; translate to RefundTaxError.
  [minor] [team lesson LS-007]   tax_adapter.ts:7  keep cents until the border; avoid cents/100.
  [minor] [team lesson LS-014]   order_repository.ts:48  swallowed error accepted by team until ORD-88. No action.

Not reviewed (foreign zone): vendor/legacy-tax-client/**
Questions (low confidence): none
Verdict: no blockers found. Humans to approve.
```

The agent **never approves or merges**. It reduces repeated work and tells the author which comments are negotiable (team lessons) and which are not (floors).

## 6. Learning: how a lesson is born, tested and retired

Setting: LS-007 ("amounts are integer cents") does not exist yet. Watch it appear over four PRs.

### 6.1 Timeline

| Step | PR | What happens | Counts as |
|---|---|---|---|
| 1 | #498 | Agent flags `price * 0.01` (float). Lan **accepts** the comment and fixes it | Signal 1 (Lan) |
| 2 | #503 | Agent says nothing about floats. Tuan comments by hand: "use cents" | Signal 2 (Tuan, human-origin) |
| 3 | #509 | Agent flags a float. Mai replies "yes, we always use cents", fixes it | Signal 3 (Mai) |
| 4 | #509 | Threshold met: **3 consistent signals, 3 different people, same scope (team:orders)** | → **Candidate lesson** |
| 5 | Promotion PR | The Observer opens a normal PR adding `lens/orders/LS-007.md` | Human gate |
| 6 | Replay | Before merge, the Foundry re-runs the agent on the 20 golden PRs with LS-007 on | Test (see §7) |
| 7 | Merge | Replay shows floor findings unchanged and +2 correct float findings, 0 new false alarms | → **Active** |

Step 5 shows the Lesson as a reviewable file, in git, like code:

```markdown
## LS-007: Money is integer cents
- **Scope:** team:orders · path: `src/**`
- **Polarity:** prefer
- **Adds check:** "no float arithmetic on amounts; convert only at the border"
- **Evidence:** PR #498 (Lan), #503 (Tuan), #509 (Mai)
- **Confidence:** medium · **Expires:** 2027-01-24 (re-confirm or it retires)
- **Supersedes:** none
```

### 6.2 What a human can do at the gate

| Action | Result |
|---|---|
| Approve | Lesson becomes active |
| Edit scope ("only `src/refunds/**`, not whole repo") | Narrower lesson |
| Reject | Recorded as `rejected`, never proposed again with the same evidence |
| Ignore | Candidate expires; nothing changes |

### 6.3 Two other lifecycle examples

**Contested (reviewers disagree).** Tuan repeatedly asks for early returns; Huy repeatedly rejects them. Signals conflict, so the system creates `LS-021 (contested)`. The agent **does not apply it** and instead asks at the next relevant PR: "Team preference unclear: early return vs single exit. Which should I record?" A human answer resolves it.

**Retired (stale).** LS-014 ("accept swallowed error in `order_repository.ts` until ORD-88") never fires after ORD-88 is closed and the file is cleaned up. It was not re-confirmed for 90 days, so it **expires**. The agent stops applying it, and the swallowed-error check is strict again.

### 6.4 "Is this machine learning?"

No weights change. It is **a notebook the agent reads before each review**, written under human supervision. That is why it can be audited ("why did the agent say this?" → LS-007 → PR #498, #503, #509), corrected, and rolled back with `git revert`.

## 7. Trust: golden set and the autonomy ladder

### 7.1 The golden set

A folder of **past PRs with the human outcome known**:

```text
evals/pr-reviewer/
├── pr-0301/  diff + "reviewers raised: DS-2 (accepted), naming nit (dismissed)"
├── pr-0317/  diff + "contained a real bug: missing auth check (blocker, fixed)"
├── pr-0322/  diff + "no issues; merged as is"
└── …  (target: 20 to start)
```

Running the agent on each and comparing to the human outcome gives:

| Metric | Meaning | Example run |
|---|---|---|
| **Acceptance rate** | Of the agent's comments, how many did a human accept? | 14 of 20 = 70% |
| **Noise rate** | Comments the human dismissed as irrelevant | 6 of 20 = 30% |
| **Missed blockers** | Real blockers humans found that the agent missed | 0 of 3 |
| **Floor recall** | Did floor findings still appear after a Lens change? | 3 of 3 |

### 7.2 Why the replay protects you

You propose Lesson LS-030: "Ignore auth-check comments in `src/internal/**`, it is a private network." Replay on the golden set:

```text
BEFORE LS-030: floor recall 3/3  (pr-0317 missing auth check → found)
AFTER  LS-030: floor recall 2/3  (pr-0317 is under src/internal/ → NOT found)
→ Promotion BLOCKED: lowers floor recall. Also, Lens may not touch Q-SEC-1.
```

A bad lesson is caught **before** it changes behaviour, by a test, not by luck.

### 7.3 Autonomy ladder

| Level | The agent may | Moves up when (example thresholds) | Example today |
|---|---|---|---|
| 1 `suggest-only` | Post a private summary to the author | Start level | Start here |
| 2 `comment` | Post public review comments | Acceptance ≥ 70%, noise ≤ 30%, missed blockers = 0, over ≥ 30 PRs | After 30 PRs |
| 3 `request-changes` | Mark a PR "changes requested" for blockers | Acceptance ≥ 85%, floor recall = 100%, 0 false blockers over ≥ 50 PRs | Probably never needed |

It also **moves down automatically**: one false `blocker` that a human overrides drops the agent one level until reviewed. The agent never gets approve or merge rights at any level.

## 8. All parts, one picture

```text
PR #512 opened
   │
   ▼
RESOLVER ── reads ──► L0 floors · L1 rules · L2 facts (zones, owners) · L3 Lens · L4 the PR
   │                         builds Context Pack: 9 items, each with a source
   ▼
AGENT (stateless) ── critical-thinking pass ──► raw findings (with confidence)
   │                         ZONE foreign? → only border checks (§4)
   ▼
SYNTHESIS ── dedupe vs humans · rank · cap · label by layer (§5)
   │
   ▼
HUMANS review, accept / dismiss / edit comments
   │
   ▼
OBSERVER records signals ──► 3 signals, 2+ people, 1 scope ──► Candidate Lesson (§6)
   │
   ▼
PROMOTION GATE: human approves + replay on golden set (§7) ──► L3 Lens (next PR is smarter)
```

## 9. What is still unknown or unverified

- **Floor tagging** does not exist yet; §3 assumes a `floor` marker that must be added to the rules.
- **Signal collection**: reading "accepted / dismissed / edited" from the PR host differs per platform (GitHub vs others). I did not verify any platform's API.
- **All thresholds** (3 signals, 90 days, 70% / 85%, 20 golden PRs) are starting guesses. Calibrate with real PR history.
- **Nothing here was run.** This is design documentation; the example outputs were written by hand to show the intended behaviour.
