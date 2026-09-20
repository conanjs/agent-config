# Format Rules — Excel (.xlsx)

Use only when the content is genuinely structured (a checklist, a comparison matrix, a glossary-as-table) — not for narrative explainers, which fight the row/column shape. If in doubt, use [[formats/markdown]] instead.

**Tooling honesty note:** I cannot emit an `.xlsx` binary directly. The real path is a library (`openpyxl`/`pandas`) or writing a `.csv` per sheet and letting the user open it in Excel — say so explicitly rather than implying a one-step "generate the Excel file."

## Section mapping

Two valid layouts, pick one per doc:

- **Narrative-in-a-sheet** (default): one sheet named `Doc`, two columns — `Section` | `Content` — one row per base section, in order.
- **Structured content**: sections 6 (Steps) and 7 (Glossary) each get their own sheet with real rows/columns (e.g. `Glossary` sheet: `Term | Definition`, one term per row); sections 1–5 and 8–9 stay on a `Summary` sheet using the narrative layout above.

## Constraints

- Header row bold and frozen (View → Freeze Panes) on every sheet with tabular data.
- One concept per row — no merged cells within data rows (breaks sorting/filtering for the reader).
- Sheet names match the section name exactly (`Glossary`, not `Words to know sheet`).

## Stop condition (this format's pass/fail check)

- Every sheet declared by the chosen layout actually exists.
- No empty cells in required columns (`Term`, `Definition`, etc.).
- Header row present and frozen on every tabular sheet.
- File opens without a formula-error warning (only relevant if formulas were added — a static content doc shouldn't need any).
- Passes [[doc-template-base]]'s universal content check for any prose cells (Summary sheet, definitions).

## References

**Local artifacts:**
- [[doc-template-base]] — parent template this format implements.

## Related

- [[doc-template-base]]
- [[lessons-learned]]
