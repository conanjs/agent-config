# Doc Template — Lessons Learned

Running log of mistakes made while writing team docs from [[doc-template-base]], so they don't repeat. Append a short entry every time a draft fails the stop condition for a non-obvious reason — the point is to catch the same mistake mechanically next time, not to re-derive it from scratch.

Format per entry: **What went wrong → Why it's wrong → Rule now baked into the template.**

---

## 2026-09-11 — Appliance-based analogies fail the A1 "universal" test

**What went wrong:** Early draft of the Loop Engineering concept doc used a thermostat analogy ("acts, measures, compares to a goal, acts again") for the core loop mechanism.

**Why it's wrong:** A thermostat assumes the reader has used a programmable/smart thermostat, which isn't universal, especially across an international team. It also requires understanding an abstract feedback concept (temperature regulation) rather than a concrete daily action.

**Rule now baked into the template:** [[doc-template-base]]'s writing rules explicitly say "not a domain-specific analogy (e.g. avoid 'thermostat' or 'vending machine')" — prefer something everyone does with their hands (cooking, washing) over something that depends on owning a specific appliance. `loop-engineering-simple.md` uses "tasting soup and adding salt" instead.

## 2026-09-14 — Don't cite a URL from memory, even for a well-known organization

**What went wrong:** First draft of `team-doc-template.md`'s References section cited a guessed Council of Europe URL path (`.../table-1-cefr-3.3-common-reference-levels-global-scale`) for the CEFR table, without fetching it first.

**Why it's wrong:** Guessing a URL structure for a real organization's site is exactly the kind of unverified claim the global instructions prohibit ("do NOT state assumptions as fact... verify via reliable, authoritative sources"). A plausible-looking URL that 404s is worse than no citation — it looks verified but isn't.

**Rule now baked into the template:** Any external URL added to a References section must be the literal result of a WebSearch/WebFetch call in the same turn, never typed from memory — even for a domain the model is confident about. This is really a restatement of the existing global rule in `personal-defaults.instructions.md`, logged here because it was the concrete failure case that proved the rule needs active enforcement, not just statement.

## References

**Local artifacts:**
- [[doc-template-base]] — the template both entries above fed back into.

**External authoritative sources:**
- None specific to this file — see the entries above for the sources involved in each incident.

## Related

- [[doc-template-base]] — apply this log's rules before drafting, not just after a failure.
