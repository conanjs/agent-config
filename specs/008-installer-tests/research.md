# Research: Executable scenarios for the bash installers

## Findings: behavior pinned as it is, for a decision

| Id | Scenario | What happens today | Why it may be wrong | Options |
|---|---|---|---|---|
| F-1 | (none) | `install.ps1`, `uninstall.ps1` and `lib/link-or-copy.ps1` (about 400 lines) have no scenarios. They depend on Windows symlinks, junctions, `mklink` and elevation, and turn `/` into `\`, so pwsh on macOS cannot run them meaningfully. | The Windows installer, the most complex one, has no guard. | A. Leave untested. B. A `windows-latest` CI job runs a `@windows` feature, written from that runner's real output (recommended). |
| F-2 | On Linux, install.sh routes to the Linux installer, which is not implemented yet | `install.sh` sends Linux to `linux/install.sh`, a stub that exits 1. The README's Usage section says "macOS / Linux: `./installers/install.sh` # detects OS, applies mapping.yaml". The stub itself says the shared logic is OS-agnostic. | The README promises Linux support the code does not give. | A. Fix the README. B. Make `linux/install.sh` run the same body as macOS (recommended; the scenarios then run the Linux route too). |
| F-3 | A mapping entry whose source does not exist still gets a symlink, which dangles | `apply_symlink` does not check that the source exists, so a typo in `mapping.yaml` leaves a dangling link and exit 0. | A broken install looks successful. | A. Keep. B. Report the missing source and skip it, exit 1 at the end (recommended). |

## Verification

| What | How | Result |
|---|---|---|
| Scenarios pass | `pnpm test` on macOS, Node 24.22.1, bash 3.2 | 13 installer scenarios pass (386 in the suite) |
| Private HOME | Every run sets `HOME` to the scenario's temp folder | The real `~/.copilot`, `~/.claude` were not touched |
