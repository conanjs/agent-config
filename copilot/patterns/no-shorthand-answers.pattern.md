---
schema: pattern/v1
last-updated: 2026-10-31
origin: 2026-10-31 — V had to ask for a plain re-explanation of a findings summary, then found an unexplained abbreviation ("TBD") inside the re-explanation itself
related-patterns: [explaining-mechanisms, compare-every-version, layered-guards]
---

# Pattern: No Shorthand In Answers

**Use when:** writing a chat reply that reports work: findings, test results, numbers, or a summary of docs or changes just written. It matters most after a long stretch of tool work, when words from logs, files and your own drafts feel ordinary to you but are new to the reader.
**Not for:** the documents themselves (knowledge docs have their own rules: KB-6 analogies, KB-7 stands alone), or a reply the reader asked to keep to one line.

## The pattern

1. **Write for a reader who saw none of the tool calls and opened none of the files.** Tool output, logs and the docs you just wrote are invisible to them. After hours with a word ("transcript", "thread total") it stops feeling like jargon to you; it still is to them.
2. **Define each term at first use: plain words, an analogy, one real example.** This includes file names, field names and labels picked up while working, such as `cost-state` or `stop_reason`. Example: "*transcript*: the log file Claude Code writes for each conversation, line by line, like meeting notes taken during the meeting: `~/.claude/projects/<folder>/<session-id>.jsonl`".
3. **Introduce before you point.** Write "the script", "that thread" or "the docs" only after the same reply has said which one and what it does.
4. **A finding has three parts: the claim, why it happens, and one real example with numbers.** "Because the history was re-read on each of 54 requests" names a cause but skips the mechanism (each request sends the whole conversation again), so the reader cannot rebuild it.
5. **Show the arithmetic behind every derived number.** A percentage, a "3× too high" or a "within 0.5%" comes with the small table or sum that produces it.
6. **Spell out every abbreviation on first use, and check the analogies too.** An analogy is new text and can bring its own jargon: "like "TBD" on a form" explains one unknown with another. This includes abbreviations that feel like everyday English to the writer. Read the examples in any rule as a sample, not a full list.
7. **A claim about timing or order gets a numbered timeline** that says who does what, and when. "One reply behind" is a timing claim between two actors; `explaining-mechanisms.pattern.md` rule 5 applies even when the claim is one sentence long.
8. **A catchy label may follow an explanation, never replace it.** "Counts it twice", "one reply behind" and "placeholder" are fine as names for something already explained.
9. **Concise means cutting filler, not explanations.** When space is short, report fewer findings in full, and say where the rest are. A short reply that has to be asked again costs more than a long one.
10. **Before sending, run the checklist below on the reply.**

## Why this exists

On 2026-10-30 a long research session ended with a summary of five new knowledge docs. Its findings were short bullets full of words from the session's working files. V had to ask what each one meant:

> "What does this mean `The script’s per-request totals matched Codex’s own thread total exactly in all 4 threads I checked.`? What is that script?"

The plain re-explanation was praised, yet it still carried an undefined abbreviation and a compressed timing claim, so V asked again:

> "what does TDB acronym mean without explanation leading it to be mentioned/asked here in this turn?"
“When using shorthand/symbol notation (e.g., D-1, D-3, T+1, *_suffix) …”
and asked for the cause, "so we can detect the defects in answering to avoid re-ask to just explain stuff in the old answer/reply".

What pulled the replies toward shorthand, found on 2026-10-31:

| Source | Text | What it did |
|---|---|---|
| `personal-defaults.instructions.md` | "Be concise and practical." | Pushed a summary toward compression, with no word on which loses when it clashes with the rules that ask for definitions |
| `answer-patterns.instructions.md`, `default` | "Answer — direct answer first, no preamble." | Invited a list of conclusions; nothing in the pattern asks for the "why" of each |
| `personal-defaults.instructions.md` | "When a term is technical or abstract, always add a plain-English analogy …" | Did not fire: "transcript" and "thread total" felt plain to the writer after hours of use |
| `personal-defaults.instructions.md` | "When using shorthand/symbol notation (e.g., D-1, D-3, T+1, *_suffix) …" | Should have fired: "TBD" is shorthand, and the examples are a sample, not a full list. It did not, because the writer read "TBD" as everyday English: the blind spot of rule 1, not a gap in the rule. Naming abbreviations in the line (added 2026-10-31) makes the case visible, but the checklist is what catches it |
| `personal-defaults.instructions.md` | "For any explanation involving more than one actor/component acting in sequence …" | Did not fire: a one-line finding did not look like an "explanation", though it described the harness, the API and the cache acting in turn |
| `knowledge/_system.md`, KB-7 | "**Stands alone.** The doc reads correctly without the conversation …" | Covers documents only; no rule said the same of a chat reply |
| The writer | — | Wrote the summary as a digest of the docs just written, for a reader who had not read them |

The rule set had the right ideas; what was missing was a trigger on "a reply that reports work" and a stated order between "be concise" and "define it". This pattern adds both.

## Worked example

The same three findings across the versions written in that conversation (`compare-every-version.pattern.md`):

| Finding | v1: summary, 2026-10-30 | v2: re-explanation, 2026-10-31 | Verdict |
|---|---|---|---|
| Cached tokens in Codex | "Codex counts cached tokens inside `input_tokens`, and reasoning inside output. Adding cached on top counts it twice." | "a receipt says "10 items, 7 of them on discount". You bought 10 items, not 17." plus the one-call table: `input_tokens` 30,694 · `cached_input_tokens` 23,168 · new 7,526, and the cost right (2.61 credits) against wrong (8.40 credits) | v2: v1 states the rule with no example, analogy or consequence (rules 2, 4, 5) |
| The 59% cost share | "cached reads cost a tenth per token but were still 59% of the credit cost, because the history was re-read on each of 54 requests." | "The model remembers nothing between calls … each call sends the whole conversation again", the copy-shop analogy, and the table: new input 26.70 (10%), cached 162.34 (59%), output 84.89 (31%) | v2: v1 has a number without its sum and a cause without its mechanism (rules 4, 5) |
| Placeholder output in subagent files | "hold placeholder output counts: 117 of 155 responses had no stop reason." | "Some of its lines were written while the reply was still starting, so the output count shows 1–4 tokens, like "TBD" on a form." | Neither: v1 leaves "placeholder" and "stop reason" undefined; v2 explains with an unexplained abbreviation and gives no timeline (rules 6, 7). Fixed in v3 below |

**v3 of the placeholder finding** (rules 2, 6, 7):

> The model writes its reply a piece at a time ("streaming"). At the first piece, the API already sends a token count, but only a starting value, such as 1, because the reply has barely begun; the true count arrives with the last piece. A *placeholder* is that starting value: a number that stands in until the real one is known, like writing "to be decided" in a form field.
>
> 1. **API → Claude Code:** first piece of a helper agent's reply, with `output_tokens: 1` and `stop_reason: null` (no reason to stop yet: the reply is still going).
> 2. **Claude Code → file:** writes a line to the helper's log file with that starting value.
> 3. **API → Claude Code:** last piece, with the final count, such as `output_tokens: 89`, and a stop reason (`end_turn` or `tool_use`).
> 4. **The log file** kept the value from step 2 for that line, so adding up those lines gives too little output.
>
> In one session, 117 of 155 helper replies had `stop_reason: null`, and their files showed 5,373 output tokens in total.

## Checklist

Read the reply as someone who saw only your messages, not the tool output, then check:

- [ ] **Undefined term:** every word that is not everyday English (a file, field, command, feature or label) is defined in this reply or an earlier one in this chat.
- [ ] **Dangling pointer:** every "the X", "that X" or "this X" names something this reply has already introduced.
- [ ] **Claim without why:** each finding says why it happens, not only what.
- [ ] **Number without its sum:** each derived number shows where it comes from.
- [ ] **Abbreviation:** each one is spelled out at first use, including inside analogies and examples.
- [ ] **Timing claim:** "before", "after", "behind", "still", "not yet" come with a numbered timeline.
- [ ] **Label for an explanation:** no coined phrase stands in for the mechanism.
- [ ] **Pointer for an answer:** "see the doc" is not used in place of explaining what was asked.

## References

**Local artifacts:**
- `copilot/instructions/personal-defaults.instructions.md` — the instruction lines quoted in Why this exists, and the line that points here.
- `copilot/instructions/answer-patterns.instructions.md` — the `default` reply structure.
- `copilot/frameworks/knowledge/schemas/_system.md` — KB-6 and KB-7, the same ideas for documents.
- `copilot/knowledge/ai-agents/agent-token-accounting.md` — where the explanations from the worked example now live.

**External authoritative sources:**
- [Abbreviations — Google developer documentation style guide](https://developers.google.com/style/abbreviations) — Google, living. Backs: rule 6, spell out abbreviations on first use.
- [Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming) — Anthropic, living. Backs: the v3 timeline (`message_start` carries a starting `output_tokens`; `message_delta` carries the final, cumulative count).

## Related

- `explaining-mechanisms.pattern.md` — the structure rule 7 points to.
- `compare-every-version.pattern.md` — the shape of the worked example.
- `layered-guards.pattern.md` — this pattern is a meaning check for replies; there is no script for it yet.
