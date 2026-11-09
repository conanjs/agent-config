---
schema: knowledge-doc/v1
type: concept
topic: macos
status: verified
applies-to: ["macOS 10.15+ (Files and Folders consent)", "macOS 15+ (Screen Recording re-prompts)", "tested on macOS 26.1"]
last-verified: 2026-11-05
last-updated: 2026-11-05
tags: [macos, tcc, privacy, full-disk-access, screen-recording, accessibility, tccutil, pppc, terminal, agents]
---

# TCC: macOS privacy permissions (Transparency, Consent, and Control)

## Summary
**TL;DR:** TCC (Transparency, Consent, and Control) is the macOS layer that asks the user before an app reads private data or controls the Mac: Full Disk Access, Files and Folders, Screen Recording, Accessibility, Automation, Camera, Microphone, Input Monitoring, Developer Tools. A grant belongs to the **responsible** app, so a command-line tool started from Terminal, iTerm, VS Code or an AI agent CLI gets exactly the permissions of that host app. Without a grant, Unix permissions do not matter: even your own files fail with "Operation not permitted".
**Use this when:** a shell command fails with "Operation not permitted" on a file you own, `screencapture` prints "could not create image from display", an agent or script cannot read `~/Library/Mail` or `~/Desktop`, or you need to reset or pre-approve a permission.
**Not this doc:** whether an app may *run* at all (Gatekeeper, signing) → `macos/gatekeeper-and-code-signing.md`; System Integrity Protection → `macos/sip-and-app-sandbox.md`.

## Problem
A developer runs `ls ~/Library/Mail` in their own home folder and gets "Operation not permitted", although `ls -ld` shows they own it. An AI agent running in a terminal cannot take a screenshot. `sudo` does not help. The block comes from TCC, not from file modes, and the fix is a toggle in System Settings for the *terminal app*, not for the command.

## Mental model
**Analogy:** TCC is a building's guest list kept at the front desk. Each entry names a *company* (the app), not each employee. Anyone who walks in with a Terminal badge (every shell, script and CLI started from Terminal) gets Terminal's entries. If Terminal is not on the "Mail room" list, no employee of Terminal gets in, whoever they are inside the company.

**Artifact:** from a shell started by an agent CLI inside Terminal on this Mac (macOS 26.1) ✅[^11]:
```text
$ ps -o comm= …   (process chain, child → parent)
zsh ← claude ← -zsh ← login ← /System/Applications/Utilities/Terminal.app/…/Terminal
$ ls ~/Library/Mail
ls: /Users/<user>/Library/Mail: Operation not permitted
$ screencapture -x /tmp/x.png ; echo "exit=$?"
could not create image from display
exit=1                                   # and no file is written
```

## How it works
**4 actors:**
- **Process** — the command that touches protected data (`ls`, `screencapture`, `cp`).
- **Responsible app** — the code TCC holds accountable; usually the app at the top of the launch chain ✅[^4] ✅[^5].
- **TCC (the privacy service and its database)** — stores the user's decisions per service and app ✅[^10].
- **User / administrator** — answers the prompt, flips the toggle in System Settings, or ships a management profile ✅[^2] ✅[^7].

**Protected services** (System Settings > Privacy & Security) ✅[^2]:

| Pane | Protects | Prompts? |
|---|---|---|
| Full Disk Access | All files, including other apps' data (Mail, Messages, Safari), Time Machine backups, some admin settings | No prompt: you add the app by hand ✅[^1] ✅[^2] |
| Files and Folders | Desktop, Documents, Downloads, iCloud Drive, network and removable volumes (macOS 10.15+) | Yes ✅[^1] |
| Screen & System Audio Recording | Reading screen contents and system audio | You add or toggle the app ✅[^3] |
| Accessibility | Controlling the Mac (scripts, system commands, UI control) | Yes ✅[^2] |
| Automation | Sending Apple Events to control other apps | Yes, per target app ✅[^1] ✅[^2] |
| Camera, Microphone | The devices | Yes ✅[^2] |
| Input Monitoring | Watching keystrokes, mouse and trackpad | Yes ✅[^2] |
| Developer Tools | Running software that does not meet the system security policy | You add the app ✅[^2] |
| App Management | Updating or deleting other apps | Yes ✅[^2] |

**Sequence: a CLI tool reads a protected folder** ✅[^4] ✅[^5]:
1. Terminal starts a shell; the shell starts `cp`.
2. `cp` opens a file under `~/Library/Mail`.
3. TCC walks from `cp` to its responsible code: Terminal. The exact algorithm is undocumented and complex ✅[^4].
4. Terminal has Full Disk Access → `cp` inherits it and succeeds. Terminal does not → the call fails with "Operation not permitted", and Terminal (not `cp`) is what appears in the Full Disk Access list ✅[^4].
5. An app launched with `open` or from Finder is responsible for itself; a parent can also disclaim responsibility when spawning (LLDB does this) ✅[^5].

**Where decisions live:** the privacy database ✅[^10]. A system copy sits at `/Library/Application Support/com.apple.TCC/TCC.db` ✅[^6]; each user also has `~/Library/Application Support/com.apple.TCC/`, and even listing either folder from an unprivileged terminal fails ✅[^11]. Reading or writing the database needs an Apple-only entitlement, even as root, and there is no supported way to list grants ✅[^6]. Treat it as read-only knowledge; never open or edit it.

**Tools:**
- `tccutil reset <service> [bundle-id]` — forget decisions so apps prompt again; `reset` is the only command ✅[^10]. Example from the man page: `tccutil reset All com.apple.Terminal` ✅[^10]. Service names match the profile keys, e.g. `ScreenCapture`, `SystemPolicyAllFiles`, `Accessibility`, `AppleEvents`, `ListenEvent` (Input Monitoring) ✅[^7].
- **MDM (Mobile Device Management) PPPC (Privacy Preferences Policy Control) profile** — an administrator pre-approves services per app; needs user-approved MDM, deny wins on conflict, and Camera, Microphone, Screen Capture and Input Monitoring can only be denied, not granted ✅[^7].

## Worked example
An agent CLI in Terminal is asked to screenshot the screen and back up `~/Library/Mail` (this Mac, macOS 26.1, 2026-11-05) ✅[^11]:

| Step | Action | Result | Meaning |
|---|---|---|---|
| 1 | Walk the parents of the agent's shell with `ps -o ppid=,comm=` | Top is `Terminal.app` | Terminal is the responsible app |
| 2 | `screencapture -x /tmp/x.png` | `could not create image from display`, exit 1, no file | Terminal lacks Screen Recording |
| 3 | `ls ~/Library/Mail` and `ls ~/Library/Messages` | `Operation not permitted` | Terminal lacks Full Disk Access |
| 4 | `ls -ld ~/Library/Application\ Support/com.apple.TCC` | `drwx------ <user> staff` | You own it, yet step 5 fails |
| 5 | `ls ~/Library/Application\ Support/com.apple.TCC/` | `Operation not permitted` | TCC protects its own store |
| 6 | Fix (manual, by the user) | System Settings > Privacy & Security > Screen & System Audio Recording / Full Disk Access > add Terminal ✅[^3] ✅[^2] | Every tool started from Terminal now inherits it ✅[^4] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `sudo` on a protected path | Still denied | TCC is not Unix permissions; even root needs the entitlement for the database ✅[^6] |
| Same script from Terminal vs iTerm vs VS Code | Different results | Each host app is a separate responsible app ✅[^5] |
| Shell script granted directly | Not possible as such | TCC tracks executables by code signature; a script runs as `sh` ✅[^4] |
| Grant given, Screen Recording prompt returns | Expected on macOS 15+: re-approval about monthly; 15.1 shows fewer prompts for apps used regularly ✅[^9] | Organisations can bypass the alert with the `forceBypassScreenCaptureAlert` restriction (macOS 15.1+) ✅[^8] |
| Process blocked, no prompt shown | Responsible app still appears in the Full Disk Access list | Add it there ✅[^4] |
| Program launched with `open` | Responsible for itself, own prompts | Not a child of the terminal ✅[^5] |
| Profile tries to grant Camera | Ignored; only deny is possible | PPPC rule ✅[^7] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Grant Full Disk Access to the terminal app | Every CLI and agent works | Every script you run inherits access to Mail, Messages, backups ✅[^2] ✅[^4] |
| Grant only Files and Folders entries | Narrower | More prompts; tools may fail on other paths |
| Separate terminal app for privileged work | Keeps the daily terminal unprivileged | Two apps to manage |
| PPPC profile | Silent, fleet-wide | Needs MDM; cannot grant camera, mic, screen capture ✅[^7] |

**Comparison with Linux:** Linux access control beyond file modes comes from LSMs (Linux Security Modules): policy written by an administrator (SELinux, AppArmor) or self-restriction by the program (Landlock) ✅[^12]. None of these asks the user at run time per app; see `linux/security/lsm-and-landlock.md`.

## Takeaways
- "Operation not permitted" on a file you own means TCC: grant the *host app* (Terminal, iTerm, VS Code), not the command. [rule-candidate]
- Before an agent or script screenshots or reads `~/Library`, check the host app's grants; a failing `screencapture` prints "could not create image from display". [rule-candidate]
- Use `tccutil reset <service> <bundle-id>` to re-trigger a prompt; never edit `TCC.db`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 47 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-05

## References
- [Controlling app access to files in macOS](https://support.apple.com/guide/security/controlling-app-access-to-files-secddd1d86a6/web) — Apple Platform Security guide, living. Backs: consent for Desktop/Documents/Downloads, iCloud Drive, network and removable volumes since 10.15; Full Disk Access added explicitly; Automation needs permission. [^1]
- [Change Privacy & Security settings on Mac](https://support.apple.com/guide/mac-help/change-privacy-security-settings-mac-mchl211c911f/mac) — Apple Mac User Guide, living. Backs: list and meaning of each privacy pane. [^2]
- [Control access to screen and system audio recording on Mac](https://support.apple.com/guide/mac-help/control-access-to-screen-system-audio-recording-mchld6aa7d23/mac) — Apple Mac User Guide, living. Backs: Screen & System Audio Recording pane, adding apps. [^3]
- [How can I grant full disk access to a Node-RED instance?](https://developer.apple.com/forums/thread/760291) — Apple Developer Forums (Apple DTS engineers), living. Backs: responsible code, child processes inherit Terminal's access, algorithm undocumented, blocked responsible code listed in Full Disk Access, TCC tracks executables. [^4]
- [The curious case of the responsible process](https://www.qt.io/blog/the-curious-case-of-the-responsible-process) — Qt blog, 2022. Backs: terminal becomes responsible for launched apps, `open` makes the app responsible, disclaim flag used by LLDB. [^5]
- [Apple Developer Forums thread 123489](https://developer.apple.com/forums/thread/123489) — Apple DTS engineer, living. Backs: `/Library/Application Support/com.apple.TCC/TCC.db`, Apple-only entitlement even for root, no supported way to list grants. [^6]
- [PrivacyPreferencesPolicyControl.Services](https://developer.apple.com/documentation/devicemanagement/privacypreferencespolicycontrol/services-data.dictionary) and [PrivacyPreferencesPolicyControl](https://developer.apple.com/documentation/devicemanagement/privacypreferencespolicycontrol) — Apple Developer Documentation, living. Backs: service keys, deny-only services, user-approved MDM, deny wins. [^7]
- [Restrictions](https://developer.apple.com/documentation/devicemanagement/restrictions) — Apple Developer Documentation, living. Backs: `forceBypassScreenCaptureAlert`, macOS 15.1+. [^8]
- [Apple Tweaks Screen Recording App Permissions to Decrease Popup Frequency in macOS Sequoia 15.1](https://www.macrumors.com/2024/10/07/apple-screen-recording-popup-update/) — MacRumors, 2024. Backs: weekly prompts in beta changed to monthly before release; 15.1 beta release-note quote on fewer dialogs. [^9]
- `man tccutil` (read with `man tccutil | col -b` on macOS 26.1, 2026-11-05) — privacy database, `reset` the only command, examples. [^10]
- Local test, 2026-11-05, macOS 26.1 (build 25B78), Apple silicon, shell started by an agent CLI inside Terminal: process chain via `ps`, `screencapture -x` failure, `ls` on `~/Library/Mail`, `~/Library/Messages` and both `com.apple.TCC` folders. [^11]
- [Linux Security Module Usage](https://docs.kernel.org/admin-guide/LSM/index.html) — Linux kernel documentation, living. Backs: Linux comparison. [^12]

## Related
- `linux/security/lsm-and-landlock.md` — the Linux side of mandatory and self-imposed access control.
- `macos/gatekeeper-and-code-signing.md` — code signatures, which TCC uses to identify apps.
- `macos/sip-and-app-sandbox.md` — System Integrity Protection and the App Sandbox.
- `macos/launchd-services-and-environment.md` — background jobs started outside a terminal.
- [Unified logging and diagnostics](unified-logging-and-diagnostics.md) — reading system logs when a denial is silent.
