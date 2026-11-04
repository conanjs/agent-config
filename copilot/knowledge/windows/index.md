---
schema: topic-index/v1
kind: topic
topic: windows
last-updated: 2026-11-04
---

# Windows

How Windows works inside, and Windows-specific behavior that affects how tooling and installers work: user and kernel mode, boot, registry and services, processes, handles, jobs and scheduling, virtual memory and commit, NTFS and the I/O path, tokens, ACLs, integrity levels and UAC, the Windows Filtering Platform, Windows containers and WSL 2, and diagnostics tools — each compared with its Linux counterpart. Start with `learning-path.md`. These docs were written from Microsoft Learn without a Windows lab, so examples are marked illustrative. Not covered: Active Directory, Group Policy, kernel debugging.

## Docs
| Doc | Type | Summary | Status |
|---|---|---|---|
| [learning-path.md](learning-path.md) | reference | Six stages of Windows internals, each mapped to the Linux doc to compare, with an exercise and a self-check | verified |
| [symlinks-privilege.md](symlinks-privilege.md) | legacy | Real symlinks need admin, Developer Mode or the "Create symbolic links" right, whatever the shell or PowerShell version; junction and hard link limits | — |

## Subtopics
| Subtopic | Summary |
|---|---|
| [fundamentals/](fundamentals/index.md) | User vs kernel mode, executive, objects and IRPs; the four boot phases; registry hives and the Service Control Manager |
| [processes/](processes/index.md) | Processes, threads, handles, job objects; 0–31 priorities, classes, boosts |
| [memory/](memory/index.md) | Reserve vs commit, commit limit, working sets, page faults, page file |
| [storage/](storage/index.md) | NTFS MFT, logging, ACLs, alternate data streams, sharing modes, IRP stacks |
| [security/](security/index.md) | SIDs, access tokens, ordered DACL checks, integrity levels, UAC |
| [networking/](networking/index.md) | Windows Filtering Platform vs netfilter |
| [containers/](containers/index.md) | Process vs Hyper-V isolation, WSL 2 |
| [system-management/](system-management/index.md) | Diagnostics tools, counters, ETW, Linux-to-Windows tool map |

## References
- [Win32 apps documentation](https://learn.microsoft.com/en-us/windows/win32/) — Microsoft Learn, living. Backs: topic scope.
- [Windows drivers documentation](https://learn.microsoft.com/en-us/windows-hardware/drivers/) — Microsoft Learn, living. Backs: topic scope (kernel mode).

## Related
- `linux/` — the Linux side of every mechanism here.
- `kubernetes/` — orchestration of the containers described in `containers/`.
