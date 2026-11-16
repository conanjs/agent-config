# `rendered-copy/v1`: what agents load

Agents load rendered copies under `{{AGENT_HOME}}/generated/<component>/`, where every citation shows the real path. Record DR-406, DR-307, DR-607; spec FR-045, FR-046, AC-16.1 to AC-16.10.

| Field            | Value                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner            | agent-config renderer (`installers/core`, module `rendering`; the swap rules are one pure module in `contracts/lib`)                                                                                                                                                                                                                              |
| Consumers        | agents (readers), `doctor`, uninstall, the session-start hook                                                                                                                                                                                                                                                                                     |
| Versioning rule  | Pinned by major only (FR-006); readers read the current and previous major. Changing the generated-from line, the load path or the citation form is a new major; a new optional key is not.                                                                                                                                                       |
| Missing or stale | `doctor` fails on a copy that differs from a fresh render (naming the source to edit), a writable copy, a missing first line, or a target that does not resolve from the copy's folder; `install` restores it. The session-start refresh keeps the previous copy on failure, prints one line, exits 0 and never blocks a session (AC-16.9, M-13). |

## The file this contract reads

One record of how a copy must look, with the citations it holds. Nobody writes it by hand in a repo: it is a fixture for the contract tests and for `doctor`, which compares a real copy (first line, mode, citations) with it. The renderer's output is the thing it describes. The sketch wrote `contract: rendered-copy/v1`; the file uses `schema:` instead because one reader rule covers every contract file (as `repo-layout/v1` does). Examples are in `examples/valid/` (Mac, Windows, home with a space) and `examples/invalid/`.

| Key          | Meaning                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`     | `rendered-copy/v1`                                                                                                                                                                                  |
| `system`     | `mac`, `linux` or `windows`: which separators the citation text uses                                                                                                                                |
| `copy`       | `generated/<component>/<same relative path as the source>`                                                                                                                                          |
| `first-line` | exactly ``Generated from `<source path>`; edit that file, not this copy.`` (AC-16.4); after front matter where the format needs it first (A-22)                                                     |
| `mode`       | `read-only` (0444; the read-only attribute on Windows); not a security control                                                                                                                      |
| `index`      | `{{AGENT_HOME}}/generated/index.md`, which explains the mechanism once                                                                                                                              |
| `refresh`    | when it runs (`install`, `install --update`, `session-start`) and the session-start limits: only changed, time limit in seconds, `network: none`, `on-failure: keep-previous-print-one-line-exit-0` |
| `citations`  | each `text` (real absolute path, system separators) and `target` (relative to the copy's folder, `/` separators, spaces as `%20`, A-20)                                                             |

## Rules

| Id   | Rule                                                                                                                                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RC-1 | A rendered file differs from its source only at citations, rewritten placeholder mentions and the added first line (FR-045)                                                                                                                                            |
| RC-2 | Whether a component is rendered follows from its citations; there is no flag (DR-406)                                                                                                                                                                                  |
| RC-3 | The swap rules are one pure module in `contracts/lib`, shared by the baseline, `build cite` and the renderer (A-28). The path swap applies everywhere, code blocks included; link targets are made relative by the renderer (DR-607, decided by V on 2026-11-14; A-20) |
| RC-4 | Rendering is idempotent: the same input gives byte-identical output, and an unchanged rerun rewrites no file (AC-16.7)                                                                                                                                                 |
| RC-5 | `{{AGENT_HOME}}` path placeholders left in a rendered file: 0, apart from the allow-list, the core's one-line definition and its `{{VAR}}` rule line (A-21, AC-16.3)                                                                                                   |
| RC-6 | No repo tracks a file whose first line is the generated-from line, or a build-output folder (AC-16.10)                                                                                                                                                                 |
| RC-7 | For every rendered citation, resolving its target from the copy's own folder reaches the cited file                                                                                                                                                                    |

A placeholder path such as `companies/<co>/` is not a citation and stays as text (A-24). A symlink in a source whose real path leaves the component root fails that component (M-04).

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

A home with a space, `/Users/Vinh Do/.agent-config`: the text shows `/Users/Vinh Do/.agent-config/knowledge/x.md`; the target `../../knowledge/x.md` has no space to encode because it is relative. A target that crosses a folder with a space encodes it: `../../../home%20with%20space/knowledge/x.md`.

With front matter (A-22):

```markdown
---
name: review-docs
description: Review knowledge docs and procedures before committing.
---

Generated from `skills/review-docs/body.md`; edit that file, not this copy.
```
