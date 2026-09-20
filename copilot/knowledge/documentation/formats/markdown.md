# Format Rules — Markdown (.md)

Default format. Use unless the user asks for something else, or the doc needs to be printed/signed/edited by someone without a markdown-aware editor.

## Section mapping

| Base section | Markdown |
|---|---|
| Title | `#` (H1) |
| All 10 sections | `##` (H2), in order |

## Constraints

- Keep tables narrow enough to read in a plain text editor, not just rendered.
- No raw HTML unless the target renderer needs it (e.g. an `<br>` inside a table cell) — plain markdown syntax only otherwise.
- Internal cross-references use `[[doc-name]]`-style links per this knowledge base's existing convention (see other files in `{{AGENT_HOME}}/knowledge/`).

## Stop condition (this format's pass/fail check)

- File renders correctly: all headings parse (no missing `#`), no broken table pipes, no dangling `[link](` syntax.
- All 10 sections from [[doc-template-base]] present as `##` headings, in order.
- Passes [[doc-template-base]]'s universal content check (sentence length, no idioms, terms defined, analogy is universal).
- References/Related sections populated per the global rule.

## References

**Local artifacts:**
- [[doc-template-base]] — parent template this format implements.

## Related

- [[doc-template-base]]
- [[lessons-learned]]
