# Creating Symlinks on Windows: Privilege Requirements

**Status:** Verified by direct testing on Windows 11 with Developer Mode off (registry `AllowDevelopmentWithoutDevLicense = 0`) and cross-checked against Microsoft's docs.

## Short answer

Creating a real symbolic link on Windows needs a **privilege**, not a particular shell. Every tool fails the same way without it. You need one of:

1. **Run elevated (Administrator).** Administrators hold `SeCreateSymbolicLinkPrivilege` by default.
2. **Enable Developer Mode** (Settings > System > For developers). Any user can then create symlinks without elevating. It is a machine-wide setting.
3. **Grant your user the "Create symbolic links" right** (`secpol.msc` > Local Policies > User Rights Assignment), then sign out and in. This is the narrowest option.

## Tested: the shell and version do not matter

With Developer Mode off and a non-elevated shell, each of these failed:

| Method | Result |
|---|---|
| Windows PowerShell 5.1 `New-Item -ItemType SymbolicLink` | "Administrator privilege required for this operation." |
| PowerShell 7 `New-Item -ItemType SymbolicLink` | "Administrator privilege required for this operation." |
| `cmd /c mklink` / `mklink /D` | "You do not have sufficient privilege to perform this operation." |

So installing PowerShell 7 does not fix a missing privilege. Do not recommend it as a fix.

## What the alternatives can and cannot do

| Link type | Needs privilege | Files | Directories | Across drives (C: to D:) |
|---|---|---|---|---|
| Symbolic link | Yes (see above) | Yes | Yes | Yes |
| Junction | No | No | Yes | Yes (local volumes only) |
| Hard link | No | Yes | No | **No** (same volume only) |

Consequence: with no privilege, directories can fall back to junctions, but **files cannot be linked at all when the source and target are on different drives**. Only a copy remains, and a copy does not stay in sync.

## How `agent-config` handles it

`installers/install.ps1` probes for symlink capability first. If it fails, it prints the cause and ranked fixes and changes nothing. It prefers fixes that install nothing: elevate once, then Developer Mode, then the user right. Junctions, hard links and copies are opt-in only. See `README.md`, "OS support".

## Unverified

- Whether Windows PowerShell 5.1 and PowerShell 7 differ when Developer Mode is on. Microsoft documents Developer Mode for `mklink` and for `CreateSymbolicLink` with `SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE`. On this machine, `New-Item` and `mklink` under 5.1 both worked with Developer Mode on.

## References

- [Symlinks in Windows 10](https://blogs.windows.com/windowsdeveloper/2016/12/02/symlinks-windows-10/) — Windows Developer Blog, 2016. Backs: Developer Mode lets non-elevated users create symlinks.
- [Create symbolic links (security policy)](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/security-policy-settings/create-symbolic-links) — Microsoft Learn. Backs: `SeCreateSymbolicLinkPrivilege`, Administrators by default.
- [Hard links and junctions](https://learn.microsoft.com/en-us/windows/win32/fileio/hard-links-and-junctions) — Microsoft Learn. Backs: hard links are same-volume files only; junctions are directories only.

## Related

- `README.md` — "OS support" (Windows notes).
- `installers/lib/link-or-copy.ps1` — the preflight and fallback logic.
