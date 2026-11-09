---
schema: knowledge-doc/v1
type: reference
topic: macos
status: verified
applies-to: ["macOS 26.1 (build 25B78, Apple silicon)"]
last-verified: 2026-11-06
last-updated: 2026-11-06
tags: [macos, unified-logging, console, log, predicate, crash-report, activity-monitor]
---

# Unified logging and diagnostics on macOS

## Summary
**TL;DR:** Use `log stream` while reproducing a problem and `log show` for events already retained. For a crash, open the crash report in Console. For an app that is still running but hung, sample the process in Activity Monitor.
**Use this when:** a background service fails to start, a privacy prompt does not appear, or an app crashes or hangs.

## Scope

Unified logging stores events in memory and on disk in a binary format. Console and the `log` command decode those records ✅[^1]. The commands below use the options documented by the `log` manual shipped with macOS 26.1 ✅[^2].

## Catalog

| Question | Tool and example | What you get |
|---|---|---|
| What happens while I reproduce the issue? | `log stream --level info --predicate 'process == "launchd"'` | New events from the service manager, including the info level. Start before reproducing and stop with Control-C ✅[^2]. |
| What happened in the last ten minutes? | `log show --last 10m --style compact --info --predicate 'process == "launchd"'` | Matching retained events from the specified window ✅[^2]. |
| Which events came from my app's network logger? | `log show --last 10m --predicate 'subsystem == "com.example.app" AND category == "network"'` | Records matching the subsystem and category supplied by the app's logger. Substitute the labels the app actually uses ✅[^2]. |
| How do I save an archive for later? | `sudo log collect --last 10m --output ./incident.logarchive` | A log archive for Console or `log show --archive ./incident.logarchive` ✅[^2]. |
| Did the app crash? | Console → Reports → Crash Reports | An `.ips` report when macOS recorded the crash. For app development, the crash report supplies a backtrace and termination details ✅[^3][^4]. |
| Where is the live app spending time? | Activity Monitor → select the process → System diagnostics options → Sample Process | A three-second report for the selected process ✅[^5]. |

## Lookup notes

- A predicate is a filter on event fields. Start with the process and a short time window. Add a subsystem and category when you know the app's logger labels. Those fields apply to events emitted through the unified logging interface ✅[^2].
- `--info` and `--debug` include those levels in `log show` when the records are available. A narrow filter or a record that was never retained can yield an empty result ✅[^2].
- On 2026-11-06, running `log show` from the Codex shell on macOS 26.1 returned `log: Cannot run while sandboxed`. For that error, use Console or run the command in Terminal outside the sandbox ✅[^6].
- Console's Reports sidebar also exposes spin reports (`.spin`) and some conventional text logs. Use the app's own log file when it writes one separately ✅[^3].

## Takeaways

- Start a filtered live stream before reproducing a failure whose time you can control.
- Match the evidence to the symptom. An event stream shows what was logged, a crash report describes a termination, and a process sample shows what a running process was doing.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 12 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-06

## References

- [Logging](https://developer.apple.com/documentation/os/logging/) and [Viewing Log Messages](https://developer.apple.com/documentation/os/viewing-log-messages) — Apple Developer Documentation, living. Backs: storage and retrieval model. [^1]
- `man log` on macOS 26.1 — Apple, inspected 2026-11-06. Backs: subcommands, flags, log levels and predicate fields. [^2]
- [View reports in Console on Mac](https://support.apple.com/guide/console/cnsl664be99a/mac) — Apple Console User Guide, living. Backs: report types, extensions and sidebar. [^3]
- [Diagnosing issues using crash reports and device logs](https://developer.apple.com/documentation/xcode/diagnosing-issues-using-crash-reports-and-device-logs) — Apple Developer Documentation, living. Backs: crash-report contents. [^4]
- [Run system diagnostics in Activity Monitor on Mac](https://support.apple.com/guide/activity-monitor/actmntr2225/mac) — Apple Activity Monitor User Guide, living. Backs: Sample Process duration. [^5]
- Local check, 2026-11-06, macOS 26.1 build 25B78: `/usr/bin/log show --last 1m --style compact --predicate 'process == "launchd"'` in the Codex shell returned the sandbox error above. The example commands are documented syntax. [^6]

## Related

- [launchd services and environment](launchd-services-and-environment.md) — inspect jobs and their launch context.
- [Privacy permissions](tcc-privacy-permissions.md) — identify which app macOS holds responsible for a request.
