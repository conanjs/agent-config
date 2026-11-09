---
schema: knowledge-doc/v1
type: concept
topic: macos
status: verified
applies-to: ["macOS 11+ on Apple silicon (arm64 signing rule)", "macOS 15 Sequoia+ (no Control-click bypass)", "tested on macOS 26.1"]
last-verified: 2026-11-05
last-updated: 2026-11-06
tags: [macos, gatekeeper, codesign, notarization, quarantine, xprotect, spctl, xattr, homebrew]
---

# Gatekeeper, code signing, notarization and quarantine on macOS

## Summary
**TL;DR:** On Apple silicon every native program must carry a code signature, but an **ad-hoc** signature (no certificate) is enough to *run* it. **Gatekeeper** checks downloaded software when it first opens. For apps distributed outside the Mac App Store, the standard approval path uses a **Developer ID** signature and Apple notarization. The `com.apple.quarantine` attribute is one signal that identifies a download. Since macOS 15 Sequoia, use System Settings → Privacy & Security → **Open Anyway** where macOS offers that override.
**Use this when:** an app or binary "can't be opened" or "is damaged", a downloaded CLI tool is killed at once, you want to know why a `curl`-downloaded binary runs but the same file from a browser does not, or you ship a macOS app outside the App Store.
**Not this doc:** privacy prompts (Screen Recording, Full Disk Access) → `macos/tcc-privacy-permissions.md`; System Integrity Protection and the App Sandbox → `macos/sip-and-app-sandbox.md`.

## Problem
Three different mechanisms all produce "this app can't be opened": a missing signature (the kernel kills the program), a Gatekeeper refusal (quarantined, not notarized), and malware detection (XProtect). People respond by running `xattr -cr` on everything or turning Gatekeeper off, without knowing which check failed. The usual advice "Control-click > Open" no longer works on macOS 15 and later.

## Mental model
**Analogy:** code signing is a tamper-evident seal on a parcel. An ad-hoc seal says "nobody changed this since it was sealed" but not *who* sealed it. A Developer ID seal adds the sender's verified name. Notarization is the post office X-raying the parcel and stamping "no known bombs". Quarantine is a red sticker the delivery driver (browser, AirDrop) puts on parcels from outside. Gatekeeper is the doorman who inspects only parcels with the red sticker.

**Artifact:** the same kind of check on two files on this Mac (macOS 26.1, arm64) ✅[^10]:
```text
$ spctl --assess -vv /Applications/<ThirdPartyBrowser>.app
/Applications/<ThirdPartyBrowser>.app: accepted
source=Notarized Developer ID
origin=Developer ID Application: <Vendor> (<TEAMID>)

$ cc -o t t.c && spctl --assess -vv ./t     # freshly compiled, ad-hoc signed by the linker
./t: rejected
```

## How it works
**Terms (each in one line):**
- **Code signature** — a hash of every page of the program plus its resources, sealed so any change is detected. `codesign -dv --verbose=4 <path>` prints it ✅[^9].
- **Ad-hoc signature** — signing with identity `-` (dash): no certificate, it identifies exactly one build ✅[^9]. The linker on Apple silicon applies one automatically (`flags=0x20002(adhoc,linker-signed)`) ✅[^10].
- **Developer ID** — a certificate Apple issues to registered developers for distribution outside the App Store; notarization requires it ✅[^5].
- **Notarization** — Apple's automated malware scan; a passing build gets a **ticket**, published online and optionally **stapled** (attached) to the app, disk image or installer ✅[^5].
- **Quarantine** — the extended attribute `com.apple.quarantine`. An app's `LSFileQuarantineEnabled` key says whether files it creates are quarantined by default ✅[^7]; Apple names "downloaded from the internet or transferred with AirDrop" as the quarantined cases ✅[^5].
- **XProtect** — the built-in signature-based anti-malware, using YARA rules (a pattern-matching format for malware families), updated separately from macOS ✅[^4].

**Sequence when a user opens a downloaded app (5 actors: downloader, Finder/LaunchServices, Gatekeeper, notary service, XProtect):**

| Step | Actor | What it does |
|---|---|---|
| 1 | Browser / AirDrop | Saves the file and attaches `com.apple.quarantine` (value seen here: `0081;<hex Unix time>;Chrome;<UUID>`) ✅[^10] |
| 2 | Kernel (Apple silicon) | Refuses to run any native executable without a signature; ad-hoc is enough ✅[^6] |
| 3 | Gatekeeper | On first open of quarantined software, checks for an identified developer, notarization, and that nothing was modified ✅[^1] |
| 4 | Notary ticket | Gatekeeper finds the ticket online or stapled to the file ✅[^5] and shows a first-launch dialog asking the user to approve ✅[^1] |
| 5 | XProtect | Scans on first launch, when the app changed on disk, and when its rules update; known malware is blocked and moved to the Trash ✅[^4] |
| 6 | User | Not signed or notarized: open System Settings > Privacy & Security > **Open Anyway**, confirm, and the app is saved as an exception ✅[^2] |

**What changed over time:**
- macOS 10.15 Catalina: software must be notarized by default ✅[^2].
- macOS 11 on Apple silicon: every executable must be signed, and ad-hoc is accepted, but ad-hoc binaries cannot pass Gatekeeper ✅[^6].
- macOS 15 Sequoia: Control-click > Open no longer overrides Gatekeeper; users must go to Privacy & Security ✅[^3]. Commands that change the `spctl` rule database or global state are no longer supported (configuration profiles instead) ✅[^9].

**Commands (all read-only except the last):**

| Command | Shows |
|---|---|
| `codesign -dv --verbose=4 <app>` | Authority chain, `TeamIdentifier`, flags (`runtime` = hardened runtime, `adhoc`) ✅[^10] |
| `spctl --status` | `assessments enabled` when Gatekeeper is on ✅[^10] |
| `spctl --assess -vv <app>` | `accepted`/`rejected` plus `source=` (`Apple System`, `Notarized Developer ID`) ✅[^10] |
| `xattr -l <file>` | All extended attributes with values ✅[^9] |
| `stapler validate <app>` | Whether a ticket is stapled; needs full Xcode, not just the Command Line Tools ✅[^10] |
| `xattr -d com.apple.quarantine <file>` | Removes that file’s quarantine metadata. Use `xattr -p` to inspect the attribute during diagnosis ✅[^9] |

## Worked example
A developer compares a `curl` download, a browser download and a locally compiled binary (this Mac, macOS 26.1, 2026-11-05, scratch files in `/tmp`) ✅[^10]:

| Step | Command | Result |
|---|---|---|
| 1 | `curl -s -o page.html https://support.apple.com/` then `xattr -l page.html` | No output: `curl` sets no quarantine |
| 2 | `xattr -p com.apple.quarantine ~/Downloads/report.pdf` (browser download) | `0081;6aea949e;Chrome;6B86…` — `date -r $((16#6aea949e))` gives the download time |
| 3 | `cc -o t t.c && codesign -dv t` | `Signature=adhoc`, `flags=0x20002(adhoc,linker-signed)`; `./t` exits 0 |
| 4 | `codesign --remove-signature t2 && ./t2` | Exit code 137 (killed by SIGKILL, signal 9): unsigned arm64 code does not run |
| 5 | `codesign -s - t2 && ./t2` | Exit 0: an ad-hoc signature is enough to run |
| 6 | `spctl --assess -vv t` | `rejected`: no Developer ID or notarization, so Gatekeeper would refuse it if it were quarantined; it still ran in step 3 because a local build has no quarantine attribute |
| 7 | `xattr -w com.apple.quarantine "0081;00000000;Safari;" q.txt`, then `xattr -d …` | Attribute appears, then is gone |

Lesson: a tool fetched by `curl` or a package manager script runs if it is signed at all; the same file downloaded in a browser also needs Developer ID plus notarization, or Open Anyway.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Unsigned arm64 binary (e.g. after `strip` or editing the file) | Killed at launch, exit 137 | Signature is mandatory on Apple silicon; re-sign with `codesign -s -` ✅[^6] ✅[^10] |
| "App can't be opened" / "is damaged" | App was modified, corrupted or tampered with | Signature no longer matches ✅[^2] |
| Known malware | Can't be opened and moved to the Trash | XProtect ✅[^4] ✅[^2] |
| Control-click > Open on macOS 15+ | No longer bypasses | Use Privacy & Security > Open Anyway ✅[^3] |
| Managed Mac | Some Gatekeeper settings unavailable | Device management can restrict overrides ✅[^2] ✅[^1] |
| First launch while offline, ticket not stapled | Gatekeeper cannot find the ticket online | Stapling puts it in the file ✅[^5] |
| App plug-in downloaded or AirDropped | Loads only if notarized (macOS 10.15+) | Quarantined plug-ins rule ✅[^5] |
| Homebrew cask | Artifact keeps `com.apple.quarantine` (empty agent field seen) | Homebrew passes quarantine on ✅[^10] |
| `brew install --no-quarantine` | Deprecated in Homebrew 5.0.0; absent from `brew install --help` in 7.0.11 | Homebrew stopped offering Gatekeeper bypass ✅[^8] ✅[^10] |
| Unsigned casks | Casks failing Gatekeeper checks disabled from September 2026 | Homebrew policy ✅[^8] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Developer ID + notarize + staple | Opens with one dialog, also offline | Paid developer account; hardened runtime required ✅[^5] |
| Ad-hoc signing only | Free, enough for local builds and `curl` installs | Blocked when quarantined ✅[^6] |
| `xattr -d com.apple.quarantine` on one trusted file | Removes quarantine metadata from one file | Changes the evidence available to diagnose how macOS handled the download |
| Open Anyway | Per-app, user-approved exception | Manual; not scriptable |

## Takeaways
- Diagnose before bypassing: `codesign -dv --verbose=4`, `spctl --assess -vv`, `xattr -l` tell you which check failed. [rule-candidate]
- After modifying an arm64 binary, re-sign it with `codesign -s -`, or it is killed with exit 137. [rule-candidate]
- Inspect quarantine metadata and the app signature when diagnosing a Gatekeeper refusal. Use the documented Open Anyway flow when macOS offers it.
- On macOS 15+ tell users "Privacy & Security > Open Anyway", not "Control-click > Open".

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 43 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-05

## References
- [Gatekeeper and runtime protection in macOS](https://support.apple.com/guide/security/gatekeeper-and-runtime-protection-sec5599b66df/web) — Apple Platform Security guide, living. Backs: Gatekeeper checks identified developer, notarization and integrity; first-launch approval; device management can restrict overrides. [^1]
- [Safely open apps on your Mac](https://support.apple.com/en-us/102445) — Apple Support, living. Backs: Open Anyway flow and exception, notarization required since Catalina, "can't be opened" for modified apps, malware moved to Trash, managed Macs. [^2]
- [Updates to runtime protection in macOS Sequoia](https://developer.apple.com/news/?id=saqachfa) — Apple Developer News, 2024. Backs: Control-click override removed in macOS 15. [^3]
- [Protecting against malware in macOS](https://support.apple.com/guide/security/protecting-against-malware-sec469d47bd8/web) — Apple Platform Security guide, living. Backs: XProtect YARA signatures, scan triggers, Trash, separate updates. [^4]
- [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) — Apple Developer Documentation, living. Backs: Developer ID and hardened runtime requirements, ticket online or stapled, first-launch dialog, AirDrop/internet quarantine, notarized plug-ins. [^5]
- [macOS Big Sur 11.0.1 Universal Apps Release Notes](https://developer.apple.com/documentation/macos-release-notes/macos-big-sur-11_0_1-universal-apps-release-notes) — Apple Developer Documentation, 2020. Backs: arm64 executables must be signed, ad-hoc is enough, ad-hoc cannot pass Gatekeeper. [^6]
- [LSFileQuarantineEnabled](https://developer.apple.com/documentation/bundleresources/information-property-list/lsfilequarantineenabled) — Apple Developer Documentation, living. Backs: per-app key for quarantining created files. [^7]
- [Homebrew 5.0.0](https://brew.sh/2025/11/12/homebrew-5.0.0/) — Homebrew project, 2025. Backs: `--no-quarantine` deprecated, unsigned casks deprecated, Gatekeeper-failing casks disabled September 2026. [^8]
- `man codesign`, `man spctl`, `man xattr` (read with `man <x> | col -b` on macOS 26.1, 2026-11-05) — ad-hoc identity `-`, `linker-signed` flag, `spctl` rule changes unsupported since macOS 15.0, `xattr -l`/`-p`/`-w`/`-d`. [^9]
- Local test, 2026-11-05, macOS 26.1 (build 25B78), Apple silicon: `sw_vers`, `spctl --status`, `codesign -dv --verbose=4` and `spctl --assess -vv` on Safari and a third-party notarized app, `xattr -p` on browser downloads and a Homebrew cask binary, `curl` download without quarantine, compile/strip/re-sign of a scratch binary in `/tmp`, `stapler validate` failing without Xcode, `brew install --help` (Homebrew 7.0.11). [^10]

## Related
- `macos/tcc-privacy-permissions.md` — the other "permission" system: privacy consent prompts.
- `macos/sip-and-app-sandbox.md` — System Integrity Protection and the App Sandbox.
- `macos/homebrew.md` — casks, taps and install locations.
- `macos/keychain.md` — where signing identities live.
- `macos/macos-app-path.md`
