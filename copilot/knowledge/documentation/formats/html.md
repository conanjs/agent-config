# Format Rules — HTML

Use for a shareable, interactive page — especially if it benefits from being a live, linkable Artifact rather than a static file someone has to download.

Two sub-paths:
- **Static single file** — no Artifact tool involved, just a plain `.html` file.
- **Published Artifact** — use the `Artifact` tool. If chosen, **load the `artifact-design` skill before writing it** (per this environment's own rules) — don't hand-roll artifact conventions from memory.

## Section mapping

| Base section | HTML |
|---|---|
| Title | `<h1>` (and `<title>` if published as an Artifact) |
| All 10 sections | `<h2>` blocks, in order; anchor IDs per section enable a simple in-page nav if the doc is long |

## Constraints

- Static path: single self-contained file, no external dependencies, so it opens from disk without a server.
- Artifact path: must be responsive at phone width, theme-aware (light/dark), and follow the CDN/asset rules in the `artifact-design`/`artifact-capabilities` skills — these are enforced by the platform, not optional style choices.
- Either path: don't embed content that depends on JavaScript to be readable at all — a team member at A1 English shouldn't also need a working script to see the text.

## Stop condition (this format's pass/fail check)

- Renders with no console errors.
- All internal anchor links resolve to the section they point at.
- Artifact path only: passes the responsive (≥400px width, no horizontal scroll) and theme (`prefers-color-scheme` + `data-theme`) checks from `artifact-design`.
- Passes [[doc-template-base]]'s universal content check.

## References

**Local artifacts:**
- [[doc-template-base]] — parent template this format implements.
- `artifact-design`, `artifact-capabilities` skills (this environment) — authoritative for the Artifact sub-path's constraints.

## Related

- [[doc-template-base]]
- [[lessons-learned]]
