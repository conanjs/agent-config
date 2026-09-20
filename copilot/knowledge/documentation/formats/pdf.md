# Format Rules — PDF

Use for a final, non-editable, printable handout. PDF is almost always an **export target**, not authored directly — write the content as [[formats/markdown]] or [[formats/word]] first, then export.

**Tooling honesty note:** I cannot emit a `.pdf` binary directly either. Real paths: `pandoc` markdown → PDF (needs a LaTeX engine or `wkhtmltopdf` installed — verify with `which pandoc` and check its PDF engine before promising this), Word's built-in "Export as PDF," or print-to-PDF from a rendered HTML version ([[formats/html]]).

## Section mapping

Same as [[formats/word]] — each of the 9 base sections is a heading; the export process carries the heading structure into PDF bookmarks if the source used real heading styles (another reason not to skip Word's built-in styles).

## Constraints

- Print-safe margins (source doc should already default to these — don't override to squeeze in content).
- Don't split a numbered list or a table across a page break if avoidable.
- Avoid relying on color alone to convey meaning (may be printed in black & white).
- Add page numbers if the doc exceeds 1 page.

## Stop condition (this format's pass/fail check)

- Opens in a standard PDF reader without errors.
- No text or table cut off at a page edge.
- No section heading left orphaned alone at the bottom of a page with its content starting on the next.
- If bookmarks/ToC exist, they match the actual section order.
- Passes [[doc-template-base]]'s universal content check (inherited from the source doc — check *before* exporting, not after).

## References

**Local artifacts:**
- [[doc-template-base]] — parent template this format implements.

## Related

- [[doc-template-base]]
- [[lessons-learned]]
