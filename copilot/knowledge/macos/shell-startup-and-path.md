---
schema: knowledge-doc/v1
type: reference
topic: macos
status: verified
applies-to: ["macOS 26.1", "zsh 5.9 (/bin/zsh)", "GNU bash 3.2.57 (/bin/bash)"]
last-verified: 2026-11-05
last-updated: 2026-11-05
tags: [macos, zsh, bash, sh, startup-files, path, path_helper, terminal, nvm, homebrew]
---

# zsh startup files and PATH on macOS

## Summary
**TL;DR:** Which startup files a shell reads depends on two yes/no properties: **login** and **interactive**. Terminal.app opens login + interactive zsh, so it reads everything; a `zsh -c`, `bash -c` or `sh -c` started by a GUI app is neither, so it reads at most `~/.zshenv` (zsh) or nothing (bash, sh). On every login shell `/etc/zprofile` runs `path_helper`, which rebuilds PATH and pushes any earlier entries to the end. nvm (in `~/.zshrc`) is therefore seen only by interactive shells.
**Use this when:** a command works in Terminal but not in a script, an app hook, a cron-like job or an IDE task; you need to know which file to put an `export PATH=…` in; or PATH order looks wrong.
**Not this doc:** the environment launchd gives GUI apps → `launchd-services-and-environment.md`; the concrete Node-for-Dock-apps fix → `macos-app-path.md`.

## Scope
**Physical shape first.** A shell's startup is a fixed chain of plain-text script files, each sourced (run inside the shell, so its `export`s stick) or skipped depending on two flags:
- **login shell** — the first shell of a session. Analogy: the full check-in at a hotel front desk, done once. Artifact: `ps` shows it as `-zsh` (leading dash) ✅[^2] ✅[^10].
- **interactive shell** — one reading commands you type at a terminal. Analogy: a receptionist who talks to you, as opposed to one processing mail. Artifact: `zsh -i`, or a shell whose standard input is a terminal ✅[^2].

`$ZDOTDIR` is the folder for the per-user zsh files; when unset, `$HOME` is used ✅[^1]. Covers macOS 26.1 with `/bin/zsh` 5.9 and `/bin/bash` 3.2.57, checked on Apple silicon on 2026-11-05 ✅[^10].

## Catalog

### 1. zsh startup files, in reading order

| # | File | Every zsh (incl. `zsh -c`) | Login | Interactive | Shipped on macOS 26.1 |
|---|---|---|---|---|---|
| 1 | `/etc/zshenv` | yes, cannot be skipped | — | — | absent ✅[^10] |
| 2 | `$ZDOTDIR/.zshenv` | yes | — | — | user's own |
| 3 | `/etc/zprofile` | — | yes | — | present: sets `LANG` if empty, then `eval $(/usr/libexec/path_helper -s)` ✅[^10] |
| 4 | `$ZDOTDIR/.zprofile` | — | yes | — | user's own |
| 5 | `/etc/zshrc` | — | — | yes | present: history settings, key bindings ✅[^10] |
| 6 | `$ZDOTDIR/.zshrc` | — | — | yes | user's own |
| 7 | `/etc/zlogin` | — | yes | — | absent ✅[^10] |
| 8 | `$ZDOTDIR/.zlogin` | — | yes | — | user's own |
| on exit | `$ZDOTDIR/.zlogout`, then `/etc/zlogout` | — | yes (not when the shell ends by `exec`) | — | `/etc/zlogout` absent ✅[^10] |

Order and conditions ✅[^1]. Unsetting the `RCS` option skips all later files; unsetting `GLOBAL_RCS` skips later `/etc` files ✅[^1].

### 2. Files read per invocation (observed with a throwaway `ZDOTDIR` under `/tmp`) ✅[^10]

| Invocation | Login | Interactive | User files read, in order |
|---|---|---|---|
| `zsh -c 'cmd'` | no | no | `.zshenv` |
| `zsh -i -c 'cmd'` | no | yes | `.zshenv`, `.zshrc` |
| `zsh -l -c 'cmd'` | yes | no | `.zshenv`, `.zprofile`, `.zlogin` |
| `zsh -l -i` (what Terminal.app starts) | yes | yes | `.zshenv`, `.zprofile`, `.zshrc`, `.zlogin`, and `.zlogout` on exit |
| `bash -c 'cmd'` | no | no | none (only the file named in `BASH_ENV`, if set) ✅[^4] |
| `bash -l -c 'cmd'` | yes | no | `/etc/profile`, then the first of `~/.bash_profile`, `~/.bash_login`, `~/.profile` ✅[^4] |
| interactive non-login `bash` | no | yes | `~/.bashrc` ✅[^4] |
| `sh -c 'cmd'` | no | no | none: `/bin/sh` re-executes the shell linked at `/private/var/select/sh` (`/bin/bash` here), and bash as `sh` reads no files when non-interactive ✅[^4] ✅[^5] ✅[^10] |

### 3. Who starts which kind of shell

| Starter | Shell started | Login / interactive | PATH it inherits |
|---|---|---|---|
| Terminal.app new window or tab | the account's login shell (`/bin/zsh` by default) via `login -pf <user>`, shown as `-zsh` | login + interactive ✅[^7] ✅[^10] | from Terminal, then rebuilt by `path_helper` |
| GUI app opened from the Dock running `bash -c`, `sh -c` or `zsh -c` | as named | neither | the app's own: `/usr/bin:/bin:/usr/sbin:/sbin` for a plain Dock-opened app (see `macos-app-path.md`) ✅[^10] |
| launchd job with `ProgramArguments` `/bin/zsh -c …` | zsh | neither | the job's: base `/usr/bin:/bin:/usr/sbin:/sbin` (see `launchd-services-and-environment.md`) ✅[^10] |

### 4. `path_helper`

| Item | Value |
|---|---|
| Binary | `/usr/libexec/path_helper`; Apple says it should only be called from shell profiles ✅[^3] |
| Called from | `/etc/zprofile` (zsh login) and `/etc/profile` (bash/sh login) ✅[^10] |
| Base list | `/etc/paths`, one directory per line ✅[^3] |
| Additions | every file in `/etc/paths.d`, appended after the base list ✅[^3] |
| `/etc/paths` on 26.1 | `/usr/local/bin`, `/System/Cryptexes/App/usr/bin`, `/usr/bin`, `/bin`, `/usr/sbin`, `/sbin` ✅[^10] |
| `/etc/paths.d/homebrew` | `/opt/homebrew/bin` (one example file on this Mac; any admin or installer may add files) ✅[^10] |
| Effect on existing PATH | entries not in those files are kept but moved **after** them: input `/first/dir:/usr/bin:/opt/homebrew/bin` → output `/usr/local/bin:…:/sbin:…:/opt/homebrew/bin:…:/first/dir` ✅[^10] |
| Output | shell code `PATH="…"; export PATH;` (`-s`, Bourne) or C-shell code (`-c`) ✅[^3] |

### 5. Where common tools hook in

| Tool | Lines it adds | Default file (this Mac) | Seen by |
|---|---|---|---|
| nvm | `export NVM_DIR=…` and `. "$NVM_DIR/nvm.sh"` ✅[^9] | installer picks one of `~/.bashrc`, `~/.bash_profile`, `~/.zshrc`, `~/.profile` ✅[^9]; here `~/.zshrc`, `~/.bashrc`, `~/.bash_profile` ✅[^10] | from `~/.zshrc`: interactive zsh only (Terminal, `zsh -i`); not `zsh -c`, `zsh -l -c`, `bash -c`, `sh -c` |
| Homebrew | `eval "$(/opt/homebrew/bin/brew shellenv)"` ✅[^8] | user's shell config file ✅[^8] | whichever shells read that file |
| `brew shellenv` output | sets `HOMEBREW_PREFIX`, `HOMEBREW_CELLAR`, `HOMEBREW_REPOSITORY`, prepends `/opt/homebrew/bin:/opt/homebrew/sbin` to PATH, adds zsh completions to `fpath` ✅[^10] | — | — |
| Default Homebrew prefix | `/opt/homebrew` on Apple silicon ✅[^8] | — | — |

### 6. Default shell vs `/bin/bash`

| Item | zsh | bash |
|---|---|---|
| Default login and interactive shell | since macOS 10.15 ✅[^6] | macOS 10.14 and earlier ✅[^6] |
| Version on 26.1 | 5.9 ✅[^10] | 3.2.57: `declare -A` (associative arrays) is an invalid option and `mapfile` does not exist ✅[^10] |
| `/bin/sh` | — | `/private/var/select/sh` → `/bin/bash` ✅[^10] |
| Account's shell | `dscl . -read ~ UserShell` → `UserShell: /bin/zsh` ✅[^10] | — |

## Lookup notes
1. **Put PATH changes in `~/.zprofile`, not `~/.zshenv`, for login shells.** `.zshenv` runs before `/etc/zprofile`, so `path_helper` moves whatever it added behind the system directories ✅[^10]. `.zprofile` runs after, so its prepends stay first ✅[^1].
2. **Something needed by scripts and app hooks belongs in `~/.zshenv`**, the only user file a `zsh -c` reads ✅[^10]; keep it small because every zsh reads it ✅[^1]. It does not help `bash -c` or `sh -c`.
3. **nvm in `~/.zshrc` is invisible to non-interactive shells.** With the bare app PATH, `bash -c` finds neither `node` nor `brew` ✅[^10]; use an absolute path or the launcher in `macos-app-path.md`.
4. **`/etc/zshenv` does not exist on macOS 26.1** ✅[^10]; creating it needs admin rights and affects every zsh.
5. **`/bin/bash` is old.** Scripts written for bash 4 or later fail under it; check `/bin/bash --version` or use a newer bash by absolute path.

## Takeaways
- Put PATH edits for login shells in `~/.zprofile`; `path_helper` reorders anything set earlier. [rule-candidate]
- Never rely on `~/.zshrc` (nvm, aliases) for anything a script, hook or GUI app runs; call tools by absolute path. [rule-candidate]
- `sh` on macOS is bash 3.2 in POSIX mode here; write `sh` scripts in plain POSIX syntax.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 50 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-05

## References
- [Startup/Shutdown Files](https://zsh.sourceforge.io/Doc/Release/Files.html) — zsh manual, living; same text in `man zsh` (zsh 5.9) read on this Mac 2026-11-05. Backs: Catalog 1 order and conditions, `ZDOTDIR`, `RCS`/`GLOBAL_RCS`, keep `/etc/zshenv` small. [^1]
- `man zshoptions` on macOS 26.1 — zsh 5.9, read 2026-11-05. Backs: `LOGIN` (argv[0] starting with `-`) and `INTERACTIVE` definitions. [^2]
- `man path_helper` on macOS 26.1 — Apple, read 2026-11-05. Backs: Catalog 4 base list, additions, options, profile-only use. [^3]
- `man bash` (INVOCATION) on macOS 26.1 — GNU bash 3.2, read 2026-11-05. Backs: bash login/interactive/non-interactive files, `BASH_ENV`, behaviour when invoked as `sh`. [^4]
- `man sh` on macOS 26.1 — Apple, read 2026-11-05. Backs: `/bin/sh` re-executes the shell at `/private/var/select/sh`. [^5]
- [Use zsh as the default shell on your Mac](https://support.apple.com/en-us/102360) — Apple Support, living. Backs: zsh default since macOS 10.15, bash in 10.14 and earlier. [^6]
- [Change General settings in Terminal on Mac](https://support.apple.com/guide/terminal/trmlstrtup) — Apple Terminal User Guide, living. Backs: new windows open the account's default login shell, zsh by default. [^7]
- [Homebrew Installation](https://docs.brew.sh/Installation) — Homebrew project, living. Backs: `/opt/homebrew` prefix on Apple silicon, add `eval "$(…/brew shellenv)"` to the shell config. [^8]
- [nvm README](https://github.com/nvm-sh/nvm) — nvm project, living. Backs: the profile files the installer edits and the lines it adds. [^9]
- Local test on this Mac (macOS 26.1 build 25B78, Apple silicon), 2026-11-05: `cat /etc/paths /etc/paths.d/* /etc/zprofile /etc/zshrc /etc/profile /etc/bashrc`, `ls /etc/zshenv /etc/zlogin /etc/zlogout`, throwaway `ZDOTDIR=/tmp/zt` and `HOME=/tmp/bt` with echoing startup files run via `env -i … zsh|bash|sh [-l] [-i] -c`, `env -i PATH=/first/dir:/usr/bin:/opt/homebrew/bin /usr/libexec/path_helper -s`, `ps` of Terminal's `login -pf` and `-zsh`, `brew shellenv zsh`, `grep` of nvm lines in the user's dotfiles, `dscl . -read ~ UserShell`, `ls -l /private/var/select/sh`, bash 3.2 `declare -A` / `mapfile` probe, `ps -E` PATH of Dock-opened apps and `launchctl print` default environment. Read-only apart from `/tmp`. [^10]

## Related
- `macos/launchd-services-and-environment.md` — the environment launchd gives apps and jobs.
- `macos/macos-app-path.md` — Node on the PATH of Dock-opened apps.
- `macos/homebrew.md` — Homebrew layout and commands.
- `nodejs/node-nvm-corepack-pnpm-yarn-architecture.md` — Node version managers (legacy).
