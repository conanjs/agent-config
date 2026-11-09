---
schema: topic-index/v1
kind: topic
topic: macos
last-updated: 2026-11-06
---

# macOS

macOS behavior that a developer hits on a Mac: how launchd starts apps and what environment they get, shell startup and the PATH, Homebrew, code signing and Gatekeeper, privacy permissions (TCC), System Integrity Protection and the App Sandbox, the Keychain, APFS volumes, and the diagnostics tools. Examples were captured on macOS 26.1 (Apple silicon). Not covered: kernel (XNU) internals, iOS, fleet management (MDM).

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [macos-app-path.md](macos-app-path.md) | how-to | Why Dock-opened apps (VS Code, its hooks and MCP servers) miss nvm's Node, and setting their PATH with `launchctl config user path` | verified |
| [apfs-and-volume-layout.md](apfs-and-volume-layout.md) | concept | Apple File System volumes, the sealed system volume, snapshots and shared storage | verified |
| [gatekeeper-and-code-signing.md](gatekeeper-and-code-signing.md) | concept | App signatures, notarization, quarantine and first-launch checks | verified |
| [homebrew.md](homebrew.md) | reference | Install locations, packages, services, configuration and Intel compatibility | verified |
| [keychain.md](keychain.md) | how-to | Store and retrieve credentials with the Keychain command-line tool | verified |
| [launchd-services-and-environment.md](launchd-services-and-environment.md) | concept | System and per-user jobs, job definitions and inherited environments | verified |
| [shell-startup-and-path.md](shell-startup-and-path.md) | reference | Shell startup files and how they build the command search path | verified |
| [sip-and-app-sandbox.md](sip-and-app-sandbox.md) | concept | System Integrity Protection, sandbox entitlements and runtime restrictions | verified |
| [tcc-privacy-permissions.md](tcc-privacy-permissions.md) | concept | Privacy consent, the responsible app and permission diagnostics | verified |
| [unified-logging-and-diagnostics.md](unified-logging-and-diagnostics.md) | reference | Live and historical logs, crash reports and process samples | verified |

## References
- [Apple Platform Security](https://support.apple.com/guide/security/welcome/web) — Apple, living. Backs: topic scope (signing, TCC, SIP, Keychain, APFS).
- [Daemons and Services Programming Guide](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/Introduction.html) — Apple, archived. Backs: topic scope (launchd).

## Related
- `linux/` — the Linux counterparts (systemd, permissions, namespaces, observability tools).
- `windows/` — the Windows counterparts.
