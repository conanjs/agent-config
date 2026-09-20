# Format Rules — Word (.docx)

Use when the doc needs to be edited by someone in Word directly, printed with a formal letterhead, or routed for sign-off/comments in Word's review tools.

**Tooling honesty note:** I cannot emit a `.docx` binary directly. The real path is: write the content as markdown first (matching this structure), then convert via `pandoc` (if available locally) or open/paste into Word and apply the heading styles below by hand. Say so explicitly rather than implying a one-step "generate the Word file" — verify pandoc is installed (`which pandoc`) before promising that path.

## Section mapping

| Base section | Word |
|---|---|
| Title | `Title` style (Word's built-in, not manual bold+large font) |
| All 10 sections | `Heading 2` style, in order |

Using Word's **built-in styles** (not manual formatting) is the whole point — it's what makes the Navigation Pane and an auto-generated Table of Contents work.

## Constraints

- Insert Word's built-in Table of Contents field if the doc exceeds ~2 pages — it reads directly off the Heading styles above, so it stays correct as the doc is edited.
- One consistent font/size scheme throughout (Word's default Normal + Heading styles is fine — don't hand-pick fonts per section).
- Any image needs alt text (Word: right-click → Edit Alt Text) for accessibility.

## Stop condition (this format's pass/fail check)

- File opens in Word without a corruption/repair warning.
- Navigation Pane (View → Navigation Pane) shows all 10 sections as headings, in order.
- If a Table of Contents is present, it matches the actual headings (Word: right-click → Update Field).
- Spellcheck (Word's built-in) shows no flagged errors in the body text.
- Passes [[doc-template-base]]'s universal content check.

## References

**Local artifacts:**
- [[doc-template-base]] — parent template this format implements.

## Related

- [[doc-template-base]]
- [[lessons-learned]]
