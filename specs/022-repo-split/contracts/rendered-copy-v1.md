# `rendered-copy/v1`: what agents load

**Owner:** agent-config renderer (`installers/core`, module `rendering`; rules in `contracts/lib`) · **Consumers:** agents (readers), doctor, uninstall, the session-start hook · **Record:** DR-406, DR-307, DR-304 (with security M-04, M-06, M-12, M-13) · **Spec:** FR-045, FR-046, AC-16.1 to AC-16.10, A-20 to A-22, A-24, A-27, A-28

```yaml
contract: rendered-copy/v1
applies-to: every component whose loaded files cite a location path of another component
            # today: core, agentic-sdlc, agent-companies, and every built skill and agent; never the knowledge base (linked)
output: "{{AGENT_HOME}}/generated/<component>/<same relative path as the source>"
            # generated/<component> is a link to ../store/<name>@<id>; both sit two levels below the home (DR-202)
load-path: agents load the generated/ path; routes, Claude import lines, Copilot instruction links and skill and agent
           links all point there (DR-307, AC-16.5); mount paths of a rendered component (companies/, frameworks/<name>/) link to it (A-27)
citation:
  text: real absolute path of the cited file's mount, with the system's separators
        # /Users/v/.agent-config/knowledge/x.md · C:\Users\v\.agent-config\knowledge\x.md
  target: relative path from the copy's generated/ folder to that mount path; `/` separators; spaces encoded   # ../../knowledge/x.md (A-20)
placeholder-paths: left as text       # companies/<co>/… is not a citation (A-24)
non-link mentions: a `{{AGENT_HOME}}/…` path in prose or a code span is rewritten to the real path (text only, no link); A-24's choice
first-line: "Generated from `<source path>`; edit that file, not this copy."   # after front matter where the format needs it first (A-22)
mode: read-only                       # 0444 on Mac and Linux; the read-only attribute on Windows; NOT a security control
index: "{{AGENT_HOME}}/generated/index.md"    # explains the mechanism once: what is rendered, from where, edits belong in the source
allow-list: the core's one-line {{AGENT_HOME}} definition and its {{VAR}} rule line keep the placeholder (A-21); the plan's task lists them by line
refresh:
  on: [install, install --update, session-start]
  session-start: { only-changed: true, change-detection: "file times, or .git/HEAD and the ref file read directly (M-06)",
                   lock: "try install.lock, skip if held (M-12)", time-limit-seconds: 5, network: none,
                   on-failure: keep-previous-print-one-line-exit-0 }      # never blocks a session (AC-16.9, M-13)
symlinks: a symlink in the source whose real path leaves the component root fails that component (M-04)
doctor: fails on a copy that differs from a fresh render (names the source to edit), a writable copy, a missing first line,
        or a citation target that does not resolve from the copy's folder (AC-7.5, AC-16.6)
```

## Rules

| Id | Rule |
|---|---|
| RC-1 | A rendered file differs from its source only at citations, rewritten placeholder mentions and the added first line (FR-045) |
| RC-2 | Whether a component is rendered follows from its citations (any generated `depends.slots[].docs`, or any location-path citation in a loaded file); there is no flag (DR-406) |
| RC-3 | The swap rules are one pure module in `contracts/lib`, shared by the phase-0 baseline (`build budget --baseline`), `build cite` and the renderer (A-28, TR-6) |
| RC-4 | Rendering is idempotent: the same input renders byte-identical output, and an unchanged rerun rewrites no file (AC-16.7) |
| RC-5 | `{{AGENT_HOME}}` path placeholders left in a rendered file: 0, apart from the allow-list (AC-16.3) |
| RC-6 | No repo tracks a file whose first line is the generated-from line, or a build-output folder (AC-16.10) |
| RC-7 | For every rendered citation, resolving its target from the copy's own folder reaches the cited file (QA round-trip check) |

## Worked examples

Spaces and non-ASCII (spec Edge Cases): home `/Users/Vinh Do/.agent-config`; the text shows `/Users/Vinh Do/.agent-config/knowledge/x.md`; the target `../../knowledge/x.md` has no space to encode because it is relative. A target that crosses a folder with a space encodes it: `../../../home%20with%20space/knowledge/x.md`.

With front matter (A-22):

```markdown
---
name: review-docs
description: Review knowledge docs and procedures before committing.
---
Generated from `skills/review-docs/body.md`; edit that file, not this copy.
…
```
