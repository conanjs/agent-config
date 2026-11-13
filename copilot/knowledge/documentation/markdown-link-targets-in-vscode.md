---
schema: knowledge-doc/v1
type: reference
topic: documentation
status: verified
applies-to: ["VS Code Markdown support, docs page dated 2026-11-11, read 2026-11-13"]
last-verified: 2026-11-13
last-updated: 2026-11-13
tags: [markdown, links, vscode, paths]
---

# Markdown link targets in VS Code: how each form resolves

## Summary
**TL;DR:** VS Code documents that a Markdown path starting with `/` resolves against the **workspace root**, not the file system root, and that a path with `./` or no prefix resolves against the current file. So `/Users/me/notes/x.md` written as a target is read as a path inside the workspace. For a link that must reach a file outside the workspace, a relative target such as `../../notes/x.md` is the documented form.
**Use this when:** generating or checking Markdown links that people will click in VS Code, especially links between folders that are not in the same workspace.
**Not this doc:** which files VS Code chat loads → [VS Code Copilot: harnesses and what each one loads](../github-copilot/vscode-copilot-loading.md).

## Scope
How VS Code's Markdown editor features read a link target, as documented on 2026-11-11. A link target is the address in the round brackets of `[text](target)`, like the street address on an envelope: the text is the name on the front, the target is where the post office actually goes. Example: in `/Users/me/repo/docs/a.md`, the target `../README.md` means `/Users/me/repo/README.md`, while `/README.md` means `README.md` at the root of the open workspace.

## Catalog

| Target form | Resolves against | Evidence |
|---|---|---|
| `/path/to/file.md` | The current workspace root | ✅[^md] |
| `./path/to/file.md` | The current file's folder | ✅[^md] |
| `path/to/file.md` (no prefix) | The current file's folder | ✅[^md] |
| Link validation | Links to headers, images and other local files are checked; invalid ones show as warnings or errors | ✅[^md] |

## Lookup notes
- **Not covered by the page (open, not claims):** `file:///…` URLs or file system paths (`C:\…`, `/Users/…`) as targets, and whether clicking a relative link in the preview opens the file. Test both before relying on them.
- The workspace-root rule is stated in the "Path completions" section; the page does not restate it for the preview.

## Takeaways
- Generate relative link targets when the linked file can sit outside the workspace; keep an absolute path, if needed, in the link text. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 4 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-13

## References
- [Markdown and Visual Studio Code](https://code.visualstudio.com/docs/languages/markdown) — Microsoft, living, page dated 2026-11-11, read 2026-11-13. Backs: path completion rules, link validation, link forms. [^md]
- `specs/022-repo-split/blueprint.md` — the rendering decision (G2) that uses this rule.

## Related
- [VS Code Copilot: harnesses and what each one loads](../github-copilot/vscode-copilot-loading.md)
