---
schema: knowledge-doc/v1
type: reference
topic: macos
status: verified
applies-to: ["Homebrew 7.0.x", "macOS 26.1 (Apple silicon)", "macOS on Intel (legacy)"]
last-verified: 2026-11-05
last-updated: 2026-11-05
tags: [macos, homebrew, brew, cellar, keg-only, cask, brewfile, brew-services, launchd, rosetta, analytics]
---

# Homebrew on macOS: layout, commands and settings

## Summary
**TL;DR:** Homebrew lives in one folder (its *prefix*): `/opt/homebrew` on Apple silicon, `/usr/local` on Intel. Each package version is unpacked into `Cellar/<name>/<version>` and symlinked into `bin/`, except *keg-only* packages, which stay hidden. `brew shellenv` puts the prefix on your PATH, and `brew services` runs packages as launchd agents named `homebrew.mxcl.<formula>`.
**Use this when:** you need the exact path, command, file or environment variable for a Homebrew task, or want to know why a brew-installed tool is not found.
**Not this doc:** how the shell builds its PATH → `shell-startup-and-path.md`; how launchd starts agents → `launchd-services-and-environment.md`; Gatekeeper checks on casks → `gatekeeper-and-code-signing.md`.

## Scope
Homebrew 7.0.11 on macOS 26.1 (Apple silicon), checked on 2026-11-05; Intel notes come from Homebrew's docs. Plain-English picture: the **prefix** is Homebrew's own warehouse; the **Cellar** is the shelving inside it, one shelf (a *rack*) per package and one box (a *keg*) per version; the `bin/` symlinks are the shop window that shows one box per product. Concrete artifact on this Mac: `/opt/homebrew/bin/autoconf -> ../Cellar/autoconf/2.73/bin/autoconf` ✅[^8]. Terms: CLT = Command Line Tools for Xcode; API = application programming interface (here, Homebrew's JSON package index).

## Catalog

### Prefixes

| Machine | Default prefix | Why | Support |
|---|---|---|---|
| Apple silicon | `/opt/homebrew` | Lets an Apple-silicon install and an Intel (Rosetta 2) install in `/usr/local` exist side by side and both use bottles (pre-built packages) ✅[^1] | Supported (required CPU for full support) ✅[^3] |
| Intel | `/usr/local` | The historical default ✅[^1] | Tier 3 (legacy) ✅[^3] |
| Any | the default prefix | Chosen so that installing formulae needs no `sudo` after the first install ✅[^3] | — |

### Layout inside the prefix

| Path | Holds | Example on this Mac |
|---|---|---|
| `Cellar/` | One *rack* per formula, one *keg* (versioned folder) per installed version ✅[^2] | `/opt/homebrew/Cellar/autoconf/2.73` ✅[^8] |
| `opt/<formula>` | The *opt prefix*: a symlink to the active keg, stable across upgrades ✅[^2] | `opt/sqlite -> ../Cellar/sqlite/3.53.1` ✅[^8] |
| `bin/`, `lib/`, `include/`, `share/` | Symlinks into kegs, made by `brew link` at install time ✅[^2] | `bin/autoconf -> ../Cellar/autoconf/2.73/bin/autoconf` ✅[^8] |
| `Caskroom/` | One folder per installed cask ✅[^2] | `Caskroom/gcloud-cli` ✅[^8] |
| `Library/Homebrew/` | Homebrew's own Ruby code; here the repository and the prefix are the same folder | `brew --repository` prints `/opt/homebrew` ✅[^8] |

### Package kinds

| Kind | What it is | Installs into | Example |
|---|---|---|---|
| Formula | Package definition that builds from upstream source (usually shipped as a bottle) ✅[^2] | `Cellar/` + symlinks | `brew install gh` |
| Cask | Package definition that installs pre-compiled binaries built and signed upstream, often a `.app` ✅[^2] | `Caskroom/`, apps into `/Applications` | `brew install --cask ngrok` |
| Keg-only formula | Installed in the Cellar but **not** symlinked into the prefix ✅[^2] | `Cellar/` only | `sqlite`: macOS ships its own, so `which sqlite3` gives `/usr/bin/sqlite3` ✅[^8] |
| Tap | Extra repository of formulae, casks or commands ✅[^2] | A tap directory under `Library/Taps/` | `/opt/homebrew/Library/Taps/ngrok` exists here ✅[^8]; `tap "apple/apple"` in a Brewfile ✅[^5] |

### Commands

| Command | Effect | Notes |
|---|---|---|
| `brew --prefix`, `brew --cellar`, `brew config` | Print prefix, Cellar, full setup (versions, CLT, Rosetta) | `brew config` showed `Rosetta 2: false` = brew itself runs natively ✅[^8] |
| `eval "$(brew shellenv zsh)"` | Exports `HOMEBREW_PREFIX`, `HOMEBREW_CELLAR`, `HOMEBREW_REPOSITORY`; prepends `bin`, `sbin` to `PATH`; prints nothing when they are already first ✅[^2] | Man page: put it in `~/.zprofile` (zsh) or `~/.bash_profile` (bash) on macOS ✅[^2] |
| `brew info <formula>` | Version, caveats, why it is keg-only and how to add it to `PATH` ✅[^1] | `sqlite is keg-only … because macOS already provides this software` ✅[^8] |
| `brew link <f>` / `brew link --force <f>` | Symlink a keg into the prefix; `--force` is needed for keg-only ✅[^2] | Can shadow macOS's own tool ✅[^1]; `-n` (dry run) previews ✅[^2] |
| `brew doctor` | Checks for likely problems; non-zero exit if any found; warnings are for maintainers, ignore if all works ✅[^2] | Exited 1 here with a Caskroom-metadata and a CLT warning ✅[^8] |
| `brew services list/start/stop/restart <f>` | Manage background services through `launchctl` ✅[^2] | Without `sudo`: `~/Library/LaunchAgents` (start at login); with `sudo`: `/Library/LaunchDaemons` (start at boot, as root) ✅[^2] |
| `brew bundle dump` / `brew bundle` (= `install`) / `brew bundle check` | Write a Brewfile of what is installed / install and upgrade what it lists / test whether anything is missing ✅[^5] | `brew bundle check \|\| brew bundle install` for scripts ✅[^5] |
| `brew bundle cleanup` | Uninstalls everything **not** in the Brewfile; prompts unless `--force` ✅[^2] | Destructive; read its list first |
| `brew analytics state` / `brew analytics off` | Show / turn off analytics ✅[^4] | Here: `InfluxDB analytics are enabled.` ✅[^8] |

### Files

| File | Purpose |
|---|---|
| `Brewfile` | Declarative list: `brew "ruby"`, `cask "firefox"`, `tap "…"`, `mas "…", id: …`, `brew "postgresql@16", restart_service: true` ✅[^5] |
| `~/.Brewfile` or `~/.homebrew/Brewfile` (or `$XDG_CONFIG_HOME/homebrew/Brewfile`) | The global Brewfile used with `--global` ✅[^2] |
| `~/Library/LaunchAgents/homebrew.mxcl.<formula>.plist` | launchd job written by `brew services start`; the label is `homebrew.mxcl.<formula>` ✅[^7] and the file name is the label plus `.plist` ✅[^6] |
| `~/.homebrew/services/<formula>.env` | Extra `KEY=value` environment for a service; applied on the next `brew services restart` ✅[^2] |
| `/etc/paths.d/homebrew` | Not created by `brew shellenv`; when present (as here), `path_helper` **appends** `/opt/homebrew/bin` to `PATH`, after `/usr/bin` ✅[^11] ✅[^8] |

### Environment variables

| Variable | Default | Effect |
|---|---|---|
| `HOMEBREW_NO_AUTO_UPDATE` | unset | Turns off the automatic `brew update` before `install`, `upgrade`, `tap` ✅[^1] |
| `HOMEBREW_AUTO_UPDATE_SECS` | 86400 (24 h); 3600 after a developer command; 300 with `HOMEBREW_NO_INSTALL_FROM_API` | Minimum gap between automatic updates ✅[^2] |
| `HOMEBREW_API_AUTO_UPDATE_SECS` | 450 | How often the formula/cask API data is refreshed ✅[^2] |
| `HOMEBREW_NO_INSTALL_CLEANUP` | unset | Skips the `brew cleanup` that runs after install/upgrade ✅[^2] |
| `HOMEBREW_NO_ANALYTICS` | unset | Sends no analytics (same effect as `brew analytics off`) ✅[^4] |
| `HOMEBREW_NO_INSTALL_FROM_API` | unset | Uses local tap checkouts instead of the API; needed when editing a core formula ✅[^1] |
| `HOMEBREW_UPGRADE_GREEDY` | unset | Makes `brew upgrade` include self-updating casks ✅[^1] |

### Analytics

| Fact | Value |
|---|---|
| What is sent | Aggregate, anonymous usage events, to InfluxDB over HTTPS (secure HTTP) in a background process ✅[^4] |
| Retention | 365 days ✅[^4] |
| Opt-out | `brew analytics off` or `HOMEBREW_NO_ANALYTICS=1`; a notice is shown before the first event ✅[^4] |

### Rosetta 2 and an Intel brew on Apple silicon

| Item | Fact |
|---|---|
| Rosetta 2 | Translates x86_64 (Intel) code so it runs on Apple silicon ✅[^9] |
| Run an Intel binary | `arch -x86_64 <prog>` picks the Intel slice of a universal binary ✅[^10]; `arch -x86_64 /usr/bin/true` succeeded here, so Rosetta is installed ✅[^8] |
| Intel brew | Lives in `/usr/local` next to `/opt/homebrew` ✅[^1]; run it as `arch -x86_64 /usr/local/bin/brew …`. None is installed on this Mac ✅[^8] |
| End of life | Rosetta is available through macOS 27; from macOS 28 only for some older games ✅[^9] |

## Lookup notes
- Homebrew's docs disagree on the shell file: the Installation page says `~/.zshrc` or `~/.bashrc`, the man page says `~/.zprofile` / `~/.bash_profile` on macOS ✅[^3] ✅[^2]. Login-shell files are read once per login; see `shell-startup-and-path.md` for which one GUI-started shells read.
- A brew tool that is "not found" in an app opened from the Dock is usually a PATH problem, not a Homebrew one → `macos-app-path.md`.
- `brew services list` printed nothing on this Mac: no formula services were registered, and `~/Library/LaunchAgents` held no `homebrew.mxcl.*` file ✅[^8].
- If both `/etc/paths.d/homebrew` and no `brew shellenv` are in play, `/usr/bin` tools win over Homebrew ones of the same name, `/opt/homebrew/sbin` is missing and `HOMEBREW_PREFIX` is unset ✅[^11] ✅[^8].
- Do not run `brew` with `sudo` for formulae: it lets whoever owns the prefix run code as root ✅[^2].

## Takeaways
- Find packages with `brew --prefix`, never by hard-coding `/opt/homebrew` or `/usr/local`.
- Use `brew info` before `brew link --force`: keg-only formulae are hidden on purpose.
- In scripts and CI (continuous integration), set `HOMEBREW_NO_AUTO_UPDATE=1` and `HOMEBREW_NO_ANALYTICS=1` for repeatable, quiet runs.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 68 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-05

## References
- [Homebrew FAQ](https://docs.brew.sh/FAQ) — Homebrew project, living. Backs: default prefixes and why `/opt/homebrew`, keg-only meaning, `brew link` warning, auto-update and cask-upgrade variables. [^1]
- [brew(1) manual page](https://docs.brew.sh/Manpage) — Homebrew project, living. Backs: terminology (keg, rack, Cellar, opt prefix, Caskroom, tap, formula, cask), `shellenv`, `services`, `link`, `doctor`, `bundle` file locations and `cleanup`, `HOMEBREW_*` defaults, `sudo` warning. [^2]
- [Installation](https://docs.brew.sh/Installation) — Homebrew project, living. Backs: default prefix avoids `sudo`, Intel is Tier 3, post-install `shellenv` line. [^3]
- [Anonymous Analytics](https://docs.brew.sh/Analytics) — Homebrew project, living. Backs: analytics content, transport, retention, opt-out. [^4]
- [Homebrew Bundle, brew bundle and Brewfile](https://docs.brew.sh/Brew-Bundle-and-Brewfile) — Homebrew project, living. Backs: Brewfile syntax, `bundle`/`check`. [^5]
- [Formula Cookbook](https://docs.brew.sh/Formula-Cookbook) — Homebrew project, living. Backs: launchd file name = service name + `.plist`. [^6]
- [Library/Homebrew/service.rb](https://github.com/Homebrew/brew/blob/main/Library/Homebrew/service.rb) — Homebrew project, living; same code locally at `/opt/homebrew/Library/Homebrew/service.rb` line 92. Backs: default label `homebrew.mxcl.<formula>`. [^7]
- Local test on this Mac, 2026-11-05 (macOS 26.1 build 25B78, arm64, Homebrew 7.0.11, CLT 26.3): `brew --version`, `brew --prefix`, `brew --cellar`, `brew --repository`, `brew config`, `brew shellenv`, `brew services list`, `brew doctor`, `brew info sqlite`, `brew analytics state`, `brew info --json=v2 --installed` (keg-only: icu4c@78, m4, ncurses, openssl@3, readline, sqlite), `ls -l /opt/homebrew/{bin,opt}`, `ls ~/Library/LaunchAgents`, `/etc/paths.d/homebrew`, `arch -x86_64 /usr/bin/true`. All with `HOMEBREW_NO_AUTO_UPDATE=1`; nothing installed or changed. [^8]
- [Using Intel-based apps on a Mac with Apple silicon](https://support.apple.com/en-us/102527) — Apple, 2026. Backs: Rosetta translates Intel apps; availability ends with macOS 28. [^9]
- `man arch | col -b` on this Mac (macOS 26.1) — arch(1). Backs: `-x86_64` selects the architecture of a universal binary. [^10]
- `man path_helper | col -b` on this Mac (macOS 26.1) — path_helper(8). Backs: files in `/etc/paths.d` are appended to `PATH` after `/etc/paths`. [^11]
- [Rosetta 2 on a Mac with Apple silicon](https://support.apple.com/guide/security/rosetta-2-on-a-mac-with-apple-silicon-secebb113be1/web) — Apple Platform Security, living. Backs: further reading on how Rosetta translates.

## Related
- `macos/shell-startup-and-path.md` — which startup file runs when, and how `path_helper` orders the PATH.
- `macos/launchd-services-and-environment.md` — the launchd agents that `brew services` writes.
- `macos/gatekeeper-and-code-signing.md` — the checks casks go through.
- `macos/macos-app-path.md` — brew and nvm tools missing in apps opened from the Dock.
