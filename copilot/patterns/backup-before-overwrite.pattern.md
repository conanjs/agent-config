# Pattern: Backup Before Overwrite

**Use when:** an automated process is about to replace or delete existing content that might be real, user-created data — not just when writing an installer specifically. Any script/procedure that overwrites a path it didn't create itself qualifies.

## The pattern

1. **Before replacing anything at a destination path, check whether real content already exists there.** Don't assume the destination is empty or safe to clobber just because the common case is that it will be.
2. **If something real exists, move it aside first** — to a location that (a) won't collide with anything else the same process might also be backing up in the same run, and (b) makes it obvious afterward what was backed up and when.
3. **Consolidate all of one run's backups into a single, timestamped location that mirrors the source structure**, rather than scattering `path.backup-<suffix>` siblings next to each individual real path. One backup run = one folder = easy to find, easy to inspect, easy to delete once you're confident it's not needed.
4. **Create the backup location lazily** — only when something is actually backed up. A clean run (nothing pre-existing) should leave no trace, not an empty backup folder.
5. **Never auto-restore.** The process that removes/reverts what was installed should *not* also silently restore the backup — that couples two decisions (undo the install vs. bring back the old content) that don't always want to happen together. Leave the backup in place and let a human decide.
6. **A single, well-tested "would this overwrite something real?" check, shared across every place the process writes**, beats re-deriving that check per call site. In this repo, `backup_existing`/`Backup-IfExists` is called from every `apply_symlink`/`Invoke-SymlinkMapping` call, not re-implemented per mapping entry.

## Why this exists

Almost every "install/deploy/sync into place" tool eventually needs this exact shape: symlinking, seeding config, generating scaffolding, migrating a database — anything that writes to a location that *might* already hold something a human cares about. Getting steps 2–4 wrong (overwrite without checking, scatter backups unpredictably, or restore automatically without asking) is how real data gets lost or silently confused with a computer's, quietly, during what looked like a routine operation.

## Worked example already in this repo

`installers/lib/link-or-copy.sh`'s `backup_existing` / `installers/lib/link-or-copy.ps1`'s `Backup-IfExists`, called from every symlink-strategy mapping entry:

- Destination: `~/.agent-config-backups/<timestamp>/<mapping.yaml source path>` (e.g. a pre-existing `~/.claude/CLAUDE.md` backs up to `~/.agent-config-backups/<timestamp>/claude/CLAUDE.md`) — mirrors the source structure per rule 3.
- `BACKUP_ROOT` (bash) / `$script:BackupRoot` (PowerShell) is only assigned the first time something actually needs backing up per rule 4 — a clean install creates no backup folder at all.
- `installers/uninstall.sh`/`.ps1` only remove the symlinks they created; they never touch `~/.agent-config-backups/`, per rule 5.
- A real bash bug was found here during testing: the lazy-init was first written as `$(backup_root)` — a command substitution, which runs in a subshell, so the shared `BACKUP_ROOT` assignment silently vanished and every entry got its own separate folder instead of sharing one. Fixed by inlining the assignment directly in the calling function instead of routing it through `$(...)`. Worth knowing if implementing rule 4 in bash elsewhere: lazy shared state must be set in the caller's own shell, never through a substitution.

## References

**Local artifacts:**
- `installers/lib/link-or-copy.sh`, `installers/lib/link-or-copy.ps1` — the worked implementation.
- `README.md`'s Usage section, `SETUP.md` — where the mechanism is explained for someone actually running an install.

## Related

- `index.md` — the catalog this pattern is listed in.
- `shared-procedure-thin-wrapper.pattern.md` — a different pattern, same repo; both exist because a recurring shape got named once instead of reinvented per case.
