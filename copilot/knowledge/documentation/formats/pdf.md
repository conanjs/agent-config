# Format Rules — PDF

Use for a final, non-editable, printable handout. PDF is almost always an **export target**, not authored directly — write the content as [[formats/markdown]] or [[formats/word]] first, then export.

**Tooling honesty note:** PDF binaries require a real renderer. Available paths include a project-installed PDF library, `pandoc` markdown → PDF (needs a LaTeX engine or `wkhtmltopdf` installed — verify with `which pandoc` and check its PDF engine before promising this), Word's built-in "Export as PDF," or print-to-PDF from a rendered HTML version ([[formats/html]]). Verify the installed tool and open its actual output before reporting success.

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

## Matching an existing PDF

Verified on 2026-11-08 with pdfmake 0.3.13, PDFKit 0.20.2 and fontkit 2.0.4:

- Compare actual generated documents with the same input, bundled fonts and page size. A test that only inspects a template object cannot establish visual parity.
- A PDF point is 1/72 inch, like a ruler tick for print layout. In a measured example, matching text coordinates required the font's actual 10.962-point line height, not an approximate line-height multiplier.
- Character tracking is the extra advance between letters. Spreading a missing trailing advance across every letter in each word changes the word's appearance, like redistributing one missing ruler tick among all the ticks. Measure and wrap complete lines, then render each line with unchanged tracking.
- A ligature combines several letters into one drawn shape, such as `ffi` in `Office`. PDFKit enables default features even when given an empty feature array. Explicit feature maps such as `{ kern: true, liga: false, clig: false }` retain pair kerning (spacing adjusted for a letter pair) while disabling optional joined-letter shapes. Measurement and rendering must use the same features.
- Underline thickness and position are separate from the text baseline. pdfmake 0.3.13 supports `decorationThickness`; its underline position also depends on the styled run's height and the line's ascender. Inspect both instead of moving the visible text to fix an underline.
- Separate exact pixel equality from small rasterization differences (different edge shading when turning vector shapes into pixels). Report the image dimensions, comparison threshold and remaining differences; never call a near-match pixel-identical.

Local verification used a one-page golden document, real pdfmake layout origins, extracted PDF drawing operations and equal-size raster images. The final 716 visible characters matched in spatial order; the largest horizontal difference was 0.004855 point. Exact pixel equality was not achieved. These are example measurements, not guaranteed tolerances for other fonts or documents.

A separate dependency-free experiment on 2026-11-08 grouped ten single-row pdfmake tables into one ten-row table while preserving their original text and style settings. Updating the bottom-rule callback from boundary `1` to every positive boundary preserved all 51 normalized layout items and produced zero differing pixels in the 1192 by 1686 raster comparison with the untouched implementation. Four real-render input cases also preserved text/rule positions and pagination. This establishes parity with that implementation, not with a different browser-generated reference; shared table bodies do not inherently require custom font measurement or a line-breaking dependency.

## References

- [PDFKit text documentation](https://pdfkit.org/docs/text.html) — PDFKit, living. Backs: real PDF generation, character spacing and explicit feature maps for disabling default ligatures.
- [pdfmake TextDecorator implementation](https://github.com/bpampuch/pdfmake/blob/0.3.13/src/TextDecorator.js) — pdfmake, 0.3.13. Backs: underline thickness and line-height-dependent position.

**Local artifacts:**
- [[doc-template-base]] — parent template this format implements.
- `node_modules/pdfmake/src/TextInlines.js` — measured text width and trailing character-spacing accounting, inspected in the installed project.
- `node_modules/pdfmake/src/TextDecorator.js` — installed underline geometry implementation.
- `node_modules/pdfmake/src/Renderer.js` — forwarding `fontFeatures` to PDFKit.

## Related

- [[doc-template-base]]
- [[lessons-learned]]
