# build/v1

The build tool (`contracts/tools/build.ts`) and the one file it writes that other things read: the always-loaded baseline, the measured size of what each agent loads at session start.

|           |                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Owner     | agent-config `contracts/tools/`                                                                        |
| Consumers | each repo's CI (pinned to a full commit id of a `contracts/v...` release, M-19), the installer, doctor |
| Record    | DR-411, DR-304, DR-106; spec FR-038, FR-044, FR-047, AC-1.7, AC-9.5 to AC-9.7, AC-11.6, AC-11.9        |
| File      | the baseline, JSON, `schema: build/v1` (this folder's `schema.json`)                                   |

## The tool

| Subcommand                                                                        | Does                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`                                                                           | Reads skill and agent sources with the adapters' field lists; writes deterministic output (sorted keys, LF, no timestamps) stamped with the source revision and adapter majors. Runs only agent-config's own code, never a component script (M-18); refuses symlinks that leave the root (M-04) |
| `budget`                                                                          | Counts rendered characters (Unicode code points) per agent against `idle-cost` and the total ceiling, with the same render rules as the renderer (A-28)                                                                                                                                         |
| `budget --baseline`                                                               | The dry run: renders in memory and prints the JSON report below on stdout; writes nothing                                                                                                                                                                                                       |
| `budget --baseline --out <file>`                                                  | Writes the same report to `<file>`, relative to `--root`                                                                                                                                                                                                                                        |
| `cite [--write] --provider <component.yaml path or URL> ... --slots <slots.yaml>` | Classifies each citation by the longest location mount, fails on a path under no location, checks it against the provider's exports; `--write` fills `depends.slots[].docs` and the GitHub target                                                                                               |
| `layout [--report]`                                                               | Checks `repo-layout/v1`                                                                                                                                                                                                                                                                         |
| `check-schemas <file>`                                                            | Reads each file with the reader and prints `<file>: error: <field>: <message>` or `<file>: ok`; exit 1 on any error                                                                                                                                                                             |

Exit codes: 0 ok, 1 failed, 2 usage error (A-8). The tool depends on nothing outside `contracts/` (DR-302). Its interface is a usage KDL spec plus a JSON Schema for the `--json` report (CON-15, CON-16).

## The baseline file

The report that `budget --baseline` prints and the file `--out` writes are one document and carry `"schema": "build/v1"`. A field that is missing is found by `check-schemas` against `schema.json`, not by `build`.

| Field (under `agents.<claude-code, copilot-cli, codex>`) | Meaning                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `characters`                                             | Rendered characters (Unicode code points) the agent loads at session start                              |
| `tokens_estimate`                                        | Estimated tokens; always named as an estimate, never `tokens`                                           |
| `agent_home_lines`                                       | Lines that mention the agent home in the files it loads                                                 |
| `method`                                                 | How it was measured, in words                                                                           |
| `tool_version`, `node_version`, `date`, `commit`         | Tool version, Node version such as `24.12.0`, date `YYYY-MM-DD`, 40-digit commit id                     |
| `skill_list_characters`, `skill_list_sdlc_characters`    | **`claude-code` only:** characters of name plus description for all skills, and for the `sdlc-*` skills |

All three agents are required. Other keys (for example `notes`) produce a warning and are ignored.

## Worked example

```json
{
  "schema": "build/v1",
  "agents": {
    "claude-code": {
      "characters": 400,
      "tokens_estimate": 100,
      "agent_home_lines": 3,
      "method": "dry run, rendered in memory, Unicode code points",
      "tool_version": "1",
      "node_version": "24.12.0",
      "date": "2026-11-14",
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "skill_list_characters": 36,
      "skill_list_sdlc_characters": 22
    },
    "copilot-cli": { "...": "same fields, without the two skill list fields" },
    "codex": { "...": "same fields, without the two skill list fields" }
  }
}
```

Delete `tokens_estimate` of `codex` and `check-schemas` prints `<file>: error: agents.codex.tokens_estimate: is required` and exits 1.

## Versioning rule

A component pins the major only (FR-006, "functional requirement 6"). A reader accepts the current major and the previous one (`v1` and `v0` when `v2` ships). Adding an optional key is not a new major; removing a key, renaming one or tightening a rule is. A major bump goes in this order: the reader first, then providers, then consumers, and the old major is dropped when `doctor` shows nobody still uses it (DR-418). Unknown keys never fail a file: the reader warns and ignores them (CON-10).

## When it is missing or stale

- A stamp or adapter mismatch in built output fails `doctor`; the previous output stays in place.
- A baseline file that fails this schema fails the check that reads it; the budget check compares against the last good file.

## Examples

`examples/valid/` and `examples/invalid/` are shared with the parity test (the files are JSON, so the parity test reads them as JSON).
