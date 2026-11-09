---
schema: knowledge-doc/v1
type: concept
topic: macos
status: verified
applies-to: ["macOS 11 or later (examples captured on macOS 26.1, Apple silicon)"]
last-verified: 2026-11-05
last-updated: 2026-11-05
tags: [macos, sip, csrutil, app-sandbox, entitlements, hardened-runtime, dyld, codesign, containers]
---

# System Integrity Protection and the App Sandbox

## Summary
**TL;DR:** **System Integrity Protection (SIP)** is a kernel rule book that even the root user cannot override: it keeps system folders such as `/System`, `/bin`, `/sbin` and `/usr` (but not `/usr/local`) read-only, blocks debuggers and DTrace on system processes, and strips `DYLD_*` variables when a protected program starts. The **App Sandbox** is a separate, per-app cage that an app opts into through an **entitlement** (a signed permission flag); it limits the app to its own container folder under `~/Library/Containers` plus files the user picks. The **hardened runtime** is a third, different thing: it protects a running app from code injection and is required for notarization.
**Use this when:** `sudo` cannot write to `/usr/bin`, `DYLD_LIBRARY_PATH` or `DYLD_INSERT_LIBRARIES` "does nothing", `lldb`/`dtrace` cannot attach to a system process, an app cannot open a file outside its folder, or you need to tell sandbox, hardened runtime and SIP apart.
**Not this doc:** code signing, notarization and Gatekeeper → `gatekeeper-and-code-signing.md`; privacy prompts (camera, Full Disk Access) → `tcc-privacy-permissions.md`; the read-only system volume on disk → `apfs-and-volume-layout.md`.

## Problem
A developer runs `sudo cp mytool /usr/bin/` and gets "Operation not permitted" although they are root. Another sets `DYLD_INSERT_LIBRARIES` to inject a debugging library, and it works on their own binary but silently not on `/bin/bash`. A third ships an app to the Mac App Store and finds it can no longer read `~/projects`. All three hit one of two protections, SIP or the App Sandbox, and the usual "fix" people find online, turning SIP off, weakens the whole machine.

## Mental model
**Analogy:** the Mac is an office building. **SIP** is the building's own security desk: some floors (the system folders) are locked for everyone, including the building manager (root), and only the landlord's own maintenance crew (Apple-signed system processes) holds keys. The **App Sandbox** is a visitor badge that an app chooses to wear: it opens only the app's own office (its container) and any room a person walks it into (a file picked in an Open dialog). The **hardened runtime** is a tamper-proof seal on the app's own door, so no one slips extra code into it.

**Artifact:** the three checks on this Mac (macOS 26.1) ✅[^13]:
```console
$ csrutil status
System Integrity Protection status: enabled.

$ ls -lO / | grep -E ' (bin|usr|System|Applications)$'
drwxrwxr-x  33 root  admin  sunlnk            1056 Nov  4 19:47 Applications
drwxr-xr-x@ 10 root  wheel  restricted         320 Oct 29  2025 System
drwxr-xr-x@ 39 root  wheel  restricted,hidden 1248 Oct 29  2025 bin
drwxr-xr-x@ 11 root  wheel  restricted,hidden  352 Oct 29  2025 usr

$ codesign -d --entitlements - /System/Applications/TextEdit.app
	[Key] com.apple.security.app-sandbox
	[Value]
		[Bool] true
	[Key] com.apple.security.files.user-selected.read-write
	...
```
The `restricted` flag (shown by `ls -lO`) marks a folder SIP guards; `/usr/local` shows `sunlnk` instead, not `restricted` ✅[^13].

## How it works
**4 actors:**
- **Kernel (SIP policy)** — its job: refuse changes to protected files and attachment to protected processes, for every process including root, via mandatory access controls (rules users cannot change) ✅[^1] ✅[^2].
- **dyld, the dynamic linker** — its job: load the libraries a program needs at start; it reads `DYLD_*` variables, but ignores them for SIP-protected binaries ✅[^7].
- **The app's code signature** — its job: carry the entitlements (signed key/value permissions such as `com.apple.security.app-sandbox = true`) and the hardened-runtime flag ✅[^9] ✅[^11].
- **The sandbox** — its job: confine a sandboxed app to its container and to resources its entitlements allow ✅[^8] ✅[^10].

**SIP, what it protects:**

| Protected | Still writable by installers and you | Source |
|---|---|---|
| `/System`, `/usr`, `/bin`, `/sbin`, `/var`, apps that ship with macOS | `/Applications`, `/Library`, `/usr/local` | ✅[^2] |
| Everything in `/usr` **except** `/usr/local` | `~/Library` | ✅[^3] |
| System processes: no debugger attach (even `sudo lldb`), no `task_for_pid`, no DTrace | your own apps can still be debugged | ✅[^4] |
| Kernel extensions: must be signed with a special Developer ID certificate; unsigned ones load only with SIP off (rule from the 2015 guide) | — | ✅[^5] |

Only system processes signed by Apple with special entitlements (for example a macOS update) may modify the protected parts ✅[^2] ✅[^3]. A sandboxed or plain app that hits SIP gets `EPERM` ("Operation not permitted"), not `EACCES` ("Permission denied") ✅[^10].

**SIP and `DYLD_*` variables, step by step:**
1. Your shell holds `DYLD_FOO_TEST=hello` in its environment.
2. The shell starts `/usr/bin/env`, a protected binary.
3. The `DYLD_*` variables are purged when a protected process is launched ✅[^4], so `env` never sees them.
4. The same shell starting a non-Apple binary passes them through unchanged.

Local test on this Mac ✅[^13]:

| Program started with `DYLD_FOO_TEST=hello` | Signature | Sees the variable? |
|---|---|---|
| `/usr/bin/env`, `/bin/bash`, `/usr/bin/perl`, `/usr/bin/python3` | Apple platform binary | No |
| Copy of `/usr/bin/env` in `/tmp` (no `restricted` flag) | still Apple-signed (`Identifier=com.apple.env`) | **No** |
| Homebrew `python3` | ad hoc (`flags=0x2(adhoc)`) | Yes, and `DYLD_PRINT_LIBRARIES=1` printed `dyld[…]` lines |
| nvm's `node` | hardened runtime + `allow-dyld-environment-variables` entitlement | Yes |

So copying a system binary out of `/usr/bin` did **not** bring the variables back on macOS 26.1 ✅[^13].

**Turning SIP off (do not):** `csrutil status` only reads the state. Changing it needs the Recovery system: restart into Recovery, open Terminal, run `csrutil disable` (or `enable`), restart ✅[^6] ✅[^7]. Apple says to disable it only temporarily, for example to test drivers, and notes it is not needed to run and debug apps from Xcode ✅[^6].

**App Sandbox:**
1. An app's signature carries `com.apple.security.app-sandbox = true`; new Xcode macOS projects get it by default ✅[^9].
2. At first launch macOS creates the app's container in `~/Library/Containers`; the app has full access there ✅[^10]. On this Mac TextEdit's container `~/Library/Containers/com.apple.TextEdit/Data` holds `Library`, `Documents`, `tmp` and symlinks such as `Desktop -> ../../../../Desktop` ✅[^13].
3. The app has no unrestricted access to the rest of your home folder ✅[^9]. To reach a file outside, the user picks it in an Open or Save panel, which runs in a separate process and extends the sandbox to that file (or folder, recursively) ✅[^10].
4. More access is asked for with more entitlements: `files.user-selected.read-write`, `network.client`, `device.camera`, `print` … ✅[^8]. Full Disk Access cannot be obtained by an entitlement; the user grants it in System Settings › Privacy & Security ✅[^10].
5. Mac App Store apps must enable App Sandbox ✅[^8].

**Hardened runtime vs App Sandbox vs SIP:**

| | SIP | App Sandbox | Hardened runtime |
|---|---|---|---|
| Who turns it on | macOS, on by default ✅[^1] | the app, via entitlement ✅[^9] | the app, as a signing option ✅[^11] |
| Protects | the operating system | user data and system resources from the app ✅[^8] | the app's own process from injection, library hijacking and memory tampering ✅[^11] |
| Required for | — | Mac App Store ✅[^8] | notarization ✅[^11] |
| Escape hatch | Recovery + `csrutil` ✅[^6] | more entitlements ✅[^8] | exception entitlements such as `allow-dyld-environment-variables` ✅[^12] |
| See it | `csrutil status`, `ls -lO` | `codesign -d --entitlements - <app>` ✅[^9] | `codesign -dv <app>` shows `flags=0x10000(runtime)` ✅[^13] |

VS Code on this Mac is hardened (`flags=0x10000(runtime)`) but has no `app-sandbox` entitlement ✅[^13]: the two are independent.

**Linux comparison (summary only):** SIP and the sandbox are both mandatory access control enforced by the kernel ✅[^1], which on Linux is the job of the Linux Security Modules (SELinux, AppArmor) and of Landlock for self-sandboxing: see `linux/security/lsm-and-landlock.md`. A container's own view of processes, mounts and network comes from namespaces: see `linux/containers/namespaces.md`.

## Worked example
Goal: find out why `DYLD_PRINT_LIBRARIES` prints nothing for a system tool, without touching SIP (run on 2026-11-05, macOS 26.1) ✅[^13]:
```console
$ DYLD_FOO_TEST=hello /bin/bash -c 'echo bash sees: ${DYLD_FOO_TEST:-<empty>}'
bash sees: <empty>
$ DYLD_FOO_TEST=hello /opt/homebrew/bin/python3 -c 'import os;print(os.environ.get("DYLD_FOO_TEST"))'
hello
$ DYLD_PRINT_LIBRARIES=1 /opt/homebrew/bin/brotli --version 2>&1 | head -1
dyld[41043]: <F2869D56-…> /opt/homebrew/Cellar/brotli/1.2.0/bin/brotli
$ codesign -d --entitlements - "$(which node)" | grep dyld
	[Key] com.apple.security.cs.allow-dyld-environment-variables
```
Reading: `bash` is Apple-signed and protected, so dyld dropped the variable; Homebrew's tools are not, so the variable works. To use `DYLD_*` with a shell script, run it with a non-Apple interpreter (for example Homebrew's bash) instead of disabling SIP.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `sudo touch /usr/bin/x` | Fails | `/usr` is system-only and root is restricted ✅[^2] ✅[^3] |
| Installing a tool into `/usr/local/bin` | Works (with normal permissions) | `/usr/local` is exempt ✅[^3] |
| `#!/bin/bash` script run with `DYLD_LIBRARY_PATH` set | The script never sees it; neither do programs it starts | Variables are purged at the protected `bash` launch ✅[^4] ✅[^13] |
| Copying `/usr/bin/env` to `/tmp` to escape | Still stripped on macOS 26.1 | Observed result; the copy keeps Apple's signature (`Identifier=com.apple.env`) ✅[^13] |
| `sudo lldb -p <pid of Finder>` | Attach fails | Protected process ✅[^4] |
| Your own app in Xcode | Debugging works with SIP on | SIP leaves your apps alone ✅[^4] ✅[^6] |
| Sandboxed app opens `~/code/a.txt` by path | Denied | No unrestricted home access ✅[^9] |
| Same file chosen in an Open panel | Allowed | Panel extends the sandbox ✅[^10] |
| App reads another app's container (macOS 14+) | System asks the user | Containers are tied to the code signature ✅[^10] |
| `ps -E` on TextEdit, Finder, Dock | Shows no environment; VS Code and a third-party sandboxed screenshot app showed theirs | Observed: it follows Apple system binaries, not the sandbox ✅[^13] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Keep SIP on, put tools in `/usr/local` or Homebrew | Full protection, no reboot into Recovery | `DYLD_*` tricks need a non-Apple binary |
| `csrutil disable` temporarily | Unsigned kernel extensions, attach to system processes | Machine open to malicious code until re-enabled ✅[^6] |
| Sandboxing your app | Mac App Store, less damage if compromised ✅[^8] | Open panels and bookmarks for files outside the container |

## Takeaways
- Never disable SIP to install a command-line tool; install into `/usr/local` or Homebrew's prefix. [rule-candidate]
- When `DYLD_*` seems ignored, check whether the binary is Apple-signed (`codesign -dv`) before blaming your library.
- Check a sandbox, hardened runtime and entitlements with `codesign -dv` and `codesign -d --entitlements - <app>`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 60 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-05

## References
- [System Integrity Protection](https://support.apple.com/guide/security/system-integrity-protection-secb7ea06b49/web) — Apple Platform Security, living. Backs: kernel mandatory access control, every process, on by default. [^1]
- [About System Integrity Protection on your Mac](https://support.apple.com/102149) — Apple Support, living. Backs: protected locations and exceptions, root restricted, Apple-signed processes only. [^2]
- [File System Protections](https://developer.apple.com/library/archive/documentation/Security/Conceptual/System_Integrity_Protection_Guide/FileSystemProtections/FileSystemProtections.html) — Apple, System Integrity Protection Guide (archived), 2015. Backs: `/usr` except `/usr/local`, kernel denies writes. [^3]
- [Runtime Protections](https://developer.apple.com/library/archive/documentation/Security/Conceptual/System_Integrity_Protection_Guide/RuntimeProtections/RuntimeProtections.html) — Apple, System Integrity Protection Guide (archived), 2015. Backs: attach denied, `DYLD_*` purged, DTrace, `task_for_pid`. [^4]
- [Kernel Extensions](https://developer.apple.com/library/archive/documentation/Security/Conceptual/System_Integrity_Protection_Guide/KernelExtensions/KernelExtensions.html) — Apple, System Integrity Protection Guide (archived), 2015. Backs: kext signing rule. [^5]
- [Disabling and Enabling System Integrity Protection](https://developer.apple.com/documentation/security/disabling-and-enabling-system-integrity-protection) — Apple Developer Documentation, living. Backs: Recovery steps, warning, Xcode note. [^6]
- `man dyld | col -b`, `man csrutil | col -b` — man pages on macOS 26.1. Backs: `DYLD_*` ignored for SIP-protected binaries; some `csrutil` commands need Recovery. [^7]
- [App Sandbox](https://developer.apple.com/documentation/security/app-sandbox) — Apple Developer Documentation, living. Backs: entitlement-based limits, entitlement list, Mac App Store requirement. [^8]
- [Protecting user data with App Sandbox](https://developer.apple.com/documentation/security/protecting-user-data-with-app-sandbox) — Apple Developer Documentation, living. Backs: container, no home-folder access, Xcode default, `codesign` check. [^9]
- [Accessing files from the macOS App Sandbox](https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox) — Apple Developer Documentation, living. Backs: `~/Library/Containers`, Open panels, macOS 14 container prompt, Full Disk Access, `EPERM` for SIP. [^10]
- [Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime) — Apple Developer Documentation, living. Backs: protections, notarization requirement, exception entitlements. [^11]
- [Allow DYLD environment variables entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-dyld-environment-variables) — Apple Developer Documentation, living. Backs: the `DYLD_*` exception. [^12]
- Local test, 2026-11-05, macOS 26.1 (build 25B78), Apple silicon, read-only commands plus scratch files in `/tmp`: `csrutil status`, `ls -lO /`, `codesign -d --entitlements -` and `codesign -dv` on TextEdit, VS Code and node, `ls ~/Library/Containers/com.apple.TextEdit/Data`, `DYLD_FOO_TEST`/`DYLD_PRINT_LIBRARIES` runs against `/usr/bin/env`, `/bin/bash`, `/usr/bin/perl`, `/usr/bin/python3`, a `/tmp` copy of `env`, Homebrew `python3`/`brotli` and node, and `ps -E -o command= -p <pid>` for TextEdit, Finder, Dock, VS Code and a third-party sandboxed app. [^13]

## Related
- `macos/gatekeeper-and-code-signing.md` — signatures, notarization and Gatekeeper.
- `macos/tcc-privacy-permissions.md` — privacy prompts and Full Disk Access.
- `macos/apfs-and-volume-layout.md` — the sealed system volume that backs SIP's read-only folders.
- `macos/launchd-services-and-environment.md` — what environment apps start with.
- `linux/security/lsm-and-landlock.md` — Linux's mandatory access control and self-sandboxing.
- `linux/containers/namespaces.md` — Linux isolation by namespaces.
