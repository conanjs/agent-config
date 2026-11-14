# `knowledge-provider/v1`

What a component that stores knowledge promises, and how other components cite its docs. Record DR-404; spec FR-040, AC-1.8, AC-13.1 to AC-13.8.

| Field            | Value                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner            | agent-config defines the contract (`contracts/knowledge-provider/`); agent-knowledge (slot `knowledge-storage`) and agent-companies (slot `company-knowledge-storage`) provide it                                                                                               |
| Consumers        | core, agentic-sdlc and agent-companies (citations), the installer (mount, route), `doctor`                                                                                                                                                                                      |
| Versioning rule  | Components pin the major (`1`) only (FR-006). Readers read the current and the previous major. Removing or renaming an exported doc, or any change to the citation forms, is a new major (KP-3, DR-418); a new optional key is not. Unknown keys warn and are ignored (CON-10). |
| Missing or stale | No provider installed: no route is written and the layer is skipped; core still works. A citation that no longer resolves: `doctor` lists it. Enforcement is report mode in phases 2 to 5 and blocking from phase 6.                                                            |

## The file this contract reads

`schema.json` and the reader check one declaration: a checkable view of the provider's `component.yaml` plus the citations to check. Nobody writes it by hand in a repo. `build cite` (not built yet) is meant to produce it from `component.yaml` and the cited files; `doctor` and the contract tests read it. `repository`, `locations.content`, `index` and `exports` repeat `component.yaml`, so they must agree with it, and a disagreement is a finding of the tool that produced the view. I kept the repeated keys, not a reduced file, so that the worked example (AC-1.8) is checked from one file. Examples are in `examples/valid/` and `examples/invalid/`.

| Key                 | Meaning                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `schema`            | `knowledge-provider/v1`                                                                                             |
| `slot`              | the slot the provider fills (an id, M-03)                                                                           |
| `repository`        | a GitHub address, https, no user-info (M-07); citation targets are built from it                                    |
| `locations.content` | the folder of the content location                                                                                  |
| `index`             | the entry point, `index.md` at the root of the content location (KP-1)                                              |
| `exports`           | every citable doc, at least one (KP-3); contained relative paths (M-03)                                             |
| `self-contained`    | optional; true for `knowledge-storage`: no `{{AGENT_HOME}}` line and no citation of another component in the filler |
| `citations`         | optional worked or checked citations: `file`, `text` (`{{AGENT_HOME}}/<path>`), `target` (a GitHub file address)    |

## Rules

| Id   | Rule                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KP-1 | `index.md` at the root of the `content` location is the only entry point and describes the storage's own architecture                                     |
| KP-2 | Every relative Markdown link in a body (fenced code skipped) resolves and stays inside the component; legacy docs (no `schema:` key) only warn (AC-13.5)  |
| KP-3 | `provides.exports` lists every citable doc; removing or renaming one is a major version (AC-13.2)                                                         |
| KP-4 | A moved exported doc leaves a stub at its old path for one release (CON-12, AC-13.7)                                                                      |
| KP-5 | `scripts/check.sh` passes in a checkout holding only this repo, with any provider passed in as an argument (AC-13.1, AC-10.6)                             |
| KP-6 | Cross-component citations, where the slot allows them, use the link-text form `{{AGENT_HOME}}/<location>/<path>` with a generated target (FR-023, FR-044) |

Slot rule, not contract rule (`knowledge-storage`, `self-contained: true`): no `{{AGENT_HOME}}` line and no citation of another component anywhere in the filler. That keeps the knowledge base linked (not rendered) and the component graph acyclic. agent-companies provides this contract too but fills a slot without that rule.

Core text, the one line the core keeps about knowledge layers: "Installed knowledge layers and when to read each are listed in routes; read a layer's `index.md` before its docs."

**Worked example.** A file `foo.md` of agentic-sdlc cites the knowledge doc `x.md`. The copy is rendered into `generated/<component>/foo.md` (here `generated/agentic-sdlc/foo.md`), so the relative target is `../../knowledge/x.md` on every system.

Source form, what the author writes (the target comes from `build cite --write`; the folder is the provider's `locations.content`):

[{{AGENT_HOME}}/knowledge/x.md](https://github.com/conanjs/agent-knowledge/blob/main/x.md)

Rendered on Mac, home `/Users/v/.agent-config`:

[/Users/v/.agent-config/knowledge/x.md](../../knowledge/x.md)

Rendered on Windows, home `C:\Users\v\.agent-config`:

[C:\Users\v\.agent-config\knowledge\x.md](../../knowledge/x.md)

```markdown
<!-- source: agentic-sdlc/foo.md -->

See [{{AGENT_HOME}}/knowledge/x.md](https://github.com/conanjs/agent-knowledge/blob/main/x.md).

<!-- rendered: /Users/v/.agent-config/generated/agentic-sdlc/foo.md -->

Generated from `foo.md`; edit that file, not this copy.
See [/Users/v/.agent-config/knowledge/x.md](../../knowledge/x.md).
```
