---
schema: knowledge-doc/v1
type: concept
topic: macos
status: verified
applies-to: ["macOS 13+ (SMAppService, Login Items settings)", "launchctl and launchd as shipped in macOS 26.1"]
last-verified: 2026-11-05
last-updated: 2026-11-09
tags: [macos, launchd, launchctl, launchagent, launchdaemon, plist, environment, path, login-items, smappservice]
---

# launchd services and the environment of macOS apps

## Summary
**TL;DR:** launchd is process 1 on macOS and the only supported service manager. It reads property-list (plist) job files from five `LaunchDaemons`/`LaunchAgents` folders and runs each job in a **domain**: `system` (one for the machine), `user/<uid>` and `gui/<uid>` (one per user). Manage jobs with the modern `launchctl` subcommands (`bootstrap`, `bootout`, `enable`, `disable`, `kickstart`, `print`), not the legacy `load`/`unload`. Apps opened from the Dock never read your shell files; the only documented way to give every service in a domain a PATH is `launchctl config user path` plus a reboot.
**Use this when:** you write or debug a LaunchAgent or LaunchDaemon, a GUI app does not see a variable or PATH your terminal has, or the "Background Items Added" notification or the Login Items list in System Settings needs explaining.
**Not this doc:** the concrete fix for Node on the PATH of Dock-opened apps → `macos-app-path.md`; shell startup files and `path_helper` → `shell-startup-and-path.md`; the Linux counterpart → `../linux/system-management/systemd-services.md`.

## Problem
A tool works in Terminal but a GUI app reports `command not found`. A plist copied into `~/Library/LaunchAgents` does nothing until the next login. `launchctl load` prints no error yet the job never runs. A notification "Background Items Added" appears after you install something. All four come from not knowing which launchd domain a job lives in and what environment launchd hands to the processes it starts.

## Mental model
**Analogy:** launchd is the building manager of an office tower. The `system` domain is the basement plant room (one for the whole building, only the manager's staff may change it). Each person who logs in gets their own floor (`gui/<uid>`) with its own staff list. Job plists are the job cards pinned in five fixed notice boards (folders). The manager hands every new worker a small standard kit (a bare environment); workers do not get the personal belongings you keep at your desk (your shell files).

**Artifact:** a user LaunchAgent that runs a script every hour and logs its output:
```xml
<!-- ~/Library/LaunchAgents/local.example.backup.plist (file name = Label + .plist) -->
<plist version="1.0"><dict>
  <key>Label</key><string>local.example.backup</string>          <!-- required, unique id -->
  <key>ProgramArguments</key>                                     <!-- argv; no shell, no ~ expansion -->
  <array><string>/bin/zsh</string><string>-c</string><string>$HOME/bin/backup.sh</string></array>
  <key>EnvironmentVariables</key>                                 <!-- extra variables for this job only -->
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin</string></dict>
  <key>StartInterval</key><integer>3600</integer>                 <!-- every 3600 s -->
  <key>StandardOutPath</key><string>/tmp/backup.out</string>      <!-- else stdout goes to /dev/null -->
</dict></plist>
```

## How it works
**4 actors:**
- **launchd** — its job: start the system and then every daemon, agent and XPC (cross-process communication) service, via plist definitions ✅[^1]. It runs as process ID (PID) 1, `/sbin/launchd`, and one launchd process manages all domains (`launchctl managerpid` prints `1`) ✅[^2] ✅[^8].
- **Job plists** — their job: describe one job each, in five folders ✅[^1]:

| Folder | Kind | Provided by |
|---|---|---|
| `/System/Library/LaunchDaemons` | daemon (system-wide, one instance) | Apple |
| `/System/Library/LaunchAgents` | agent (one per logged-in user) | Apple |
| `/Library/LaunchDaemons` | daemon | administrator / installers |
| `/Library/LaunchAgents` | agent, for every user | administrator / installers |
| `~/Library/LaunchAgents` | agent, for this user only | the user |

- **Domains** — their job: hold a set of services and the execution policy for them ✅[^2]:

| Domain target | What it is | Who may change it |
|---|---|---|
| `system/` | The privileged machine-wide domain where daemons live | Anyone may read; root is needed to modify ✅[^2] |
| `user/<uid>/` | Per-user domain that can exist without anyone logged in; `print` shows session type `Background` | the user ✅[^2] ✅[^8] |
| `gui/<uid>/` | The domain created when the user logs in at the graphical login window; `print` shows session type `Aqua`, and a plist from `~/Library/LaunchAgents` lands here | the user ✅[^2] ✅[^8] |

- **launchctl** — its job: inspect and change domains and services ✅[^2].

**Boot and login sequence** ✅[^4]:
1. The kernel starts launchd as the first process.
2. launchd loads the definitions from `/System/Library/LaunchDaemons` and `/Library/LaunchDaemons` into `system` and starts daemons that are not on-demand.
3. At graphical login, it loads the agents from `/System/Library/LaunchAgents`, `/Library/LaunchAgents` and `~/Library/LaunchAgents` for that user.
4. At logout it sends `SIGTERM` to the user's agents.

Daemons must not show a user interface; anything that talks to the user belongs in an agent ✅[^1]. A job must not fork into the background (`daemon(3)`, or fork and exit), or launchd thinks it died ✅[^3] ✅[^4].

**Plist keys that matter** ✅[^3]:

| Key | Default when unset | Effect |
|---|---|---|
| `Label` | required | Unique job name; convention is to name the file `<Label>.plist` |
| `ProgramArguments` | required if no `Program` | The argument vector passed to `execvp(3)`: no shell, so no `~`, `$VAR` or pipes unless you run a shell yourself |
| `RunAtLoad` | `false` | Start once when the job is loaded (at login for agents); Apple discourages it because it slows boot and login |
| `KeepAlive` | `false` (start on demand only) | `true` restarts the job whenever it exits; implies `RunAtLoad`; quick crash loops are throttled |
| `StartInterval` | none | Start every N seconds; an interval that falls while the Mac sleeps is missed |
| `EnvironmentVariables` | none | Extra variables for this job; non-string values are ignored |
| `StandardOutPath` / `StandardErrorPath` | none (launchd sends stdio to `/dev/null`) | File to receive stdout / stderr |

**Modern vs legacy `launchctl`** ✅[^2]:

| Task | Modern (domain-targeted) | Legacy |
|---|---|---|
| Load a plist into a domain | `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/x.plist` | `launchctl load x.plist` |
| Remove it | `launchctl bootout gui/$(id -u)/x` | `launchctl unload x.plist` |
| Allow / forbid loading (persists across boots) | `launchctl enable` / `disable gui/$(id -u)/x` | `load -w` / `unload -w` |
| Run now | `launchctl kickstart -k gui/$(id -u)/x` (`-k` kills a running copy first) | `launchctl start x` |
| Inspect | `launchctl print gui/$(id -u)/x` | `launchctl list` |

The legacy `load`/`unload` pick the domain from whether you are root and return a non-zero exit code only for wrong usage, so failures are silent ✅[^2]. The `print` output is for humans and may change between releases ✅[^2].

**Environment of processes launchd starts:**
1. A service's base PATH is `/usr/bin:/bin:/usr/sbin:/sbin` (`print` shows it as `default environment`) ✅[^8].
2. `launchctl config user path <value>` sets the PATH for all services in the user domains, needs a reboot, and loses to a PATH a service sets itself; it deliberately cannot set any other variable ✅[^2].
3. `launchctl setenv KEY value` sets a variable "on all future processes launched by launchd in the caller's context" ✅[^2]. It does change the domain's environment (`launchctl getenv PATH` and `print gui/<uid>` show the new value), yet VS Code reopened from the Dock after the `setenv` still had the bare PATH ✅[^8].
4. Per-job `EnvironmentVariables` apply to that job only ✅[^3].
5. `/etc/launchd.conf` is no longer read, and `~/.launchd.conf` never was ✅[^2].

**Login Items and Background Items (macOS 13 and later):**
1. An app registers its main app, a helper login item, or a LaunchAgent / LaunchDaemon plist shipped inside its own bundle with `SMAppService` (ServiceManagement framework); this replaces copying plists into `~/Library/LaunchAgents`, `/Library/LaunchAgents` or `/Library/LaunchDaemons` ✅[^5]. Such plists may use `BundleProgram`, a path relative to the app bundle ✅[^3].
2. The user sees and switches these items in System Settings > General > Login Items & Extensions: a list of items that open at login, and per-app switches that allow an app to run in the background (do work such as update checks while it is closed) ✅[^6].
3. macOS shows a notification when background items are added; devices managed by an organization can pre-approve them by matching the plist `Label` (or a label prefix) in a configuration profile ✅[^7]. On this Mac, the `BackgroundTaskManagementAgent` process started at 08:25:03, one second after a plist was written to `~/Library/LaunchAgents` ✅[^8].

**Compared with systemd** (Linux; full model in `../linux/system-management/systemd-services.md`):

| Idea | launchd | systemd |
|---|---|---|
| Job file | XML plist per job | INI-style unit file |
| Locations | 5 fixed folders | `/etc`, `/run`, `/usr/lib` with precedence and drop-ins |
| Per-user services | `gui/<uid>` / `user/<uid>` domains | `systemctl --user` instance |
| Restart policy | `KeepAlive` | `Restart=` |
| Timers | `StartInterval`, `StartCalendarInterval` | `.timer` units |
| Logs | `StandardOutPath` / `StandardErrorPath` files | journal (`journalctl -u`) |
| Start trigger | load, interval, or demand on an endpoint | dependencies (`Wants=`/`Requires=` + `After=`), sockets, timers |

## Worked example
Goal: give Dock-opened apps a PATH with Homebrew. Observed on this Mac (macOS 26.1) on 2026-11-05 ✅[^8]:

| Time | Event | Result |
|---|---|---|
| before 08:25 | VS Code opened from the Dock | main process PATH `/usr/bin:/bin:/usr/sbin:/sbin` |
| 08:25:02 | `~/Library/LaunchAgents/local.path-env.plist` (runs `/bin/launchctl setenv PATH …`, `RunAtLoad` true) is loaded and runs once, exit code 0 | `launchctl getenv PATH` and `print gui/501` show the new PATH |
| 08:25:03 | `BackgroundTaskManagementAgent` starts | the "Background Items Added" notification source |
| 08:26:16 | VS Code reopened from the Dock | main process PATH still `/usr/bin:/bin:/usr/sbin:/sbin` |

Read-only commands that show this state:
```console
$ launchctl getenv PATH
/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:…
$ launchctl print gui/$(id -u)/local.path-env | grep -A2 'default environment'
	default environment = {
		PATH => /usr/bin:/bin:/usr/sbin:/sbin
$ ps -E -o command= -p <VS Code main PID> | grep -o ' PATH=[^ ]*'
 PATH=/usr/bin:/bin:/usr/sbin:/sbin
```
For a job you own, set `EnvironmentVariables` in its plist. For the persistent user-domain setting and the Dock app check (passed 2026-11-09), see the [Dock app guide](macos-app-path.md).

## Edge cases
| Case | What happens | Why |
|---|---|---|
| New plist dropped into `~/Library/LaunchAgents` | Not loaded until next login, unless you `bootstrap` it | Agents are loaded at login ✅[^4] |
| `launchctl load` of a broken plist | Exit code 0, job silently absent | Legacy commands only fail on wrong usage ✅[^2] |
| Plist writable by group or others, or owned by another user | Refused | Security rule for job files ✅[^2] |
| `ProgramArguments` uses `~` or `$HOME` | Path not expanded | No shell; argv goes straight to `execvp` ✅[^3] |
| Job forks and the parent exits | launchd treats it as dead; with `KeepAlive` it respawns in a loop | Must stay in the foreground ✅[^4] |
| Job disabled with `launchctl disable` | Cannot be loaded until enabled, also after reboot | State persists across boots ✅[^2] |
| `StartInterval` while asleep | That run is missed | kqueue timer limitation ✅[^3] |
| Daemon tries to show a window | Not supported | UI belongs in agents ✅[^1] |
| `config user path` without reboot | No effect yet | Reboot required ✅[^2] |

## Trade-offs
| Option to give a process an environment | Gains | Costs |
|---|---|---|
| `EnvironmentVariables` in your own plist | Exact, per job, no reboot | Only for jobs you define |
| `launchctl config user path` | Persistent default for launchd user services. See the [Dock app guide](macos-app-path.md) for the Visual Studio Code check (passed 2026-11-09) | Admin and reboot; PATH only ✅[^2] |
| `launchctl setenv` from a LaunchAgent | No admin | Did not reach a Dock-opened app in the test above ✅[^8] |
| App reads the login shell itself (VS Code does) | Full shell environment | Slow shells time out; app-specific (see `macos-app-path.md`) |

## Takeaways
- Use the modern `launchctl` subcommands with an explicit domain (`gui/$(id -u)/<label>`); legacy `load` hides errors. [rule-candidate]
- A launchd job gets a bare PATH: set `EnvironmentVariables` or use absolute paths in every plist you write. [rule-candidate]
- Never fork into the background from a launchd job; let `KeepAlive` do the restarting.
- Expect the Background Items notification whenever a LaunchAgent or login item is added.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 42 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-05

## References
- `man launchd` on macOS 26.1 (`man launchd | col -b`) — Apple, read 2026-11-05. Backs: PID 1 role, daemons vs agents, no UI in daemons, the five folders. [^1]
- `man launchctl` on macOS 26.1 — Apple, read 2026-11-05. Backs: domains and who may modify them, modern and legacy subcommands, `config user path`, `setenv`, removed `launchd.conf`, `managerpid`, job file ownership rules, `print` output not stable. [^2]
- `man launchd.plist` on macOS 26.1 — Apple, read 2026-11-05. Backs: plist keys and defaults, stdio to `/dev/null`, no daemonizing, `BundleProgram` for SMAppService. [^3]
- [Creating Launch Daemons and Agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html) — Apple Daemons and Services Programming Guide (archive). Backs: boot and login loading sequence, `SIGTERM` at logout, no forking. [^4]
- [SMAppService](https://developer.apple.com/documentation/servicemanagement/smappservice) — Apple Developer Documentation, living. Backs: macOS 13+ registration of login items, LaunchAgents and LaunchDaemons from the app bundle. [^5]
- [Open items automatically when you log in on Mac](https://support.apple.com/guide/mac-help/open-items-automatically-when-you-log-in-mh15189/26/mac) — Apple Mac User Guide, macOS 26. Backs: Login Items & Extensions location, background switch. [^6]
- [Manage login items and background tasks on Mac](https://support.apple.com/guide/deployment/manage-login-items-background-tasks-mac-depdca572563/web) — Apple Platform Deployment, living. Backs: notifications for added background items, managed approval by `Label`. [^7]
- Local test on this Mac (macOS 26.1 build 25B78, Apple silicon), 2026-11-05: `launchctl print gui/501`, `print user/501`, `print system`, `print gui/501/local.path-env`, `launchctl getenv PATH`, `launchctl managerpid`, `ps -o comm -p 1`, `ps -E` start times and PATH of GUI app processes, `ls -la ~/Library/LaunchAgents`. Read-only. [^8]
- `copilot/knowledge/linux/system-management/systemd-services.md` — the systemd model compared above.

## Related
- `macos/macos-app-path.md` — the applied fix for Node on the PATH of Dock-opened apps.
- `macos/shell-startup-and-path.md` — what shells read at startup and how `path_helper` builds PATH.
- `linux/system-management/systemd-services.md` — the Linux service manager.
- `macos/tcc-privacy-permissions.md`, `macos/gatekeeper-and-code-signing.md`, `macos/unified-logging-and-diagnostics.md` — other macOS mechanisms around background jobs.
