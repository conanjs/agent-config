---
schema: knowledge-doc/v1
type: concept
topic: windows/security
status: verified
applies-to: ["Windows 10 / 11", "Windows Server 2016+"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, security, access-token, sid, dacl, ace, integrity-level, uac, privileges, impersonation]
---

# Windows security: SIDs, access tokens, ACLs, integrity levels and UAC

## Summary
**TL;DR:** Every account and group has a **SID**. At logon Windows builds an **access token** holding the user's SID, group SIDs, logon SID, privileges and a default DACL; every process gets a copy (its primary token), and threads can **impersonate** others. Every securable object (file, key, process, service…) has a security descriptor whose **DACL** is a list of allow/deny **ACEs**; the access check walks the ACEs **in order** and stops at the first deny that matches or once everything is allowed — so ACE order matters, and no DACL means full access. **Integrity levels** (low, medium, high, system) add a mandatory rule: by default a lower level cannot write to a higher-level object. **UAC** gives administrators two tokens — standard (medium) and full admin (high) — and asks for consent before using the second.
**Use this when:** you debug "Access is denied", set file or service permissions, wonder why an admin's program is not elevated, or compare with Linux UIDs, mode bits and capabilities.
**Not this doc:** NTFS internals → `storage/ntfs-and-io.md`.

## Problem
"I'm an administrator, why is access denied?" (the process runs with the filtered token), "I added an allow entry and it still fails" (an earlier deny ACE wins), "the sandboxed browser can't write my documents" (low integrity) — all require the token → DACL → integrity → UAC model.

## Mental model
**Analogy:** a building with ID cards. Your card (access token) lists your name, every team you belong to and special permits (privileges). Each door (object) has a guard with an ordered list (DACL): "Bob: no entry", "Engineers: enter", … The guard reads from the top and stops as soon as a line clearly says no, or once every requested right has been allowed. Floors have security levels (integrity): visitors from a lower floor may look but not change things upstairs. Admins carry two cards (UAC) and must say "yes, use my admin card" for each task that needs it.

**Artifact:** what an access token contains ✅[^1]:
```text
user SID · group SIDs · logon SID (current logon session) · privileges (user's and groups')
owner SID · primary group SID · default DACL for new objects · token source
primary or impersonation token · optional restricting SIDs · impersonation level · statistics
```

## How it works
**5 actors:**
- **Logon** — its job: authenticate and create the access token ✅[^1].
- **Process / thread** — its job: act with its primary token, or an impersonation token on a thread ✅[^1].
- **Securable object** — its job: carry a security descriptor with a DACL (and a SACL holding the integrity label) ✅[^3] ✅[^4].
- **Access check (Security Reference Monitor)** — its job: compare token and DACL plus mandatory integrity policy ✅[^3] ✅[^4].
- **UAC** — its job: decide which of an administrator's two tokens a new program gets ✅[^5].

1. **SIDs:** a unique variable-length identifier per trustee, issued by an authority (e.g. a domain controller); well-known SIDs exist for generic groups such as Everyone ✅[^2].
2. **Token at logon:** after authentication, the system produces an access token; every process run for the user has a copy ✅[^1].
3. **Access check** ✅[^3]:
   - No DACL → access granted.
   - Otherwise the system compares each ACE's trustee to the SIDs in the token (ignoring group SIDs not enabled) and examines ACEs **in sequence** until: an access-denied ACE denies any requested right → **denied**; or allow ACEs grant all requested rights → **granted**; or the list ends with something not granted → **implicitly denied**.
   - Order matters; system objects use a preferred order (deny entries first) ✅[^3].
4. **Mandatory integrity:** four levels — low, medium, high, system. Standard users get medium, elevated users high, services system ✅[^4]. A low-integrity principal cannot write to a medium-integrity object even if the DACL allows it; objects without a label count as medium; a new process gets the **minimum** of the user's level and the executable file's level ✅[^4].
5. **UAC:** an administrator who logs on gets two tokens — standard and administrator; `explorer.exe` runs with the standard token and every user-started program inherits it unless the user approves elevation ✅[^5]. Administrators see a **consent prompt**; standard users see a **credential prompt** ✅[^5]. Parent and child must have the same integrity level for token inheritance ✅[^5].

**Windows vs Linux:**

| Concept | Windows | Linux |
|---|---|---|
| Identity | SID in an access token | UID/GID in task credentials |
| Object permissions | DACL of ordered allow/deny ACEs | Mode bits (owner/group/other), optional POSIX ACLs |
| Super-user power | Privileges in the token, e.g. `SeBackupPrivilege` (read any file regardless of ACL), `SeDebugPrivilege` ✅[^6] | Capabilities |
| Mandatory layer | Integrity levels (+ AppContainer) | LSMs (SELinux, AppArmor, Landlock) |
| Elevation | UAC split token + prompt | `sudo` / setuid |

## Worked example
A DACL on `D:\finance` with two ACEs, in this order ✅[^3]:

| # | ACE | Trustee |
|---|---|---|
| 1 | Deny write | User `bob` |
| 2 | Allow read + write | Group `Finance` (Bob is a member) |

| Request | Walk | Result |
|---|---|---|
| Bob asks for write | ACE 1 matches Bob and denies write → stop | **Denied** |
| Bob asks for read | ACE 1 does not cover read; ACE 2 allows read → all granted | **Granted** |
| Alice (Finance) asks for write | ACE 1 not Alice; ACE 2 allows | **Granted** |

If the ACEs were reversed, ACE 2 would grant Bob write before the deny was reached — which is why order matters ✅[^3].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Object with **no** DACL | Everyone has full access | No DACL → grant ✅[^3] |
| Object with an **empty** DACL | Nobody has access | No ACE grants anything → implicit deny ✅[^3] |
| Admin runs a tool that needs admin rights without elevating | Access denied | Standard token in use ✅[^5] |
| Low-integrity process (sandbox) writes to Documents | Denied despite DACL | No-write-up integrity policy ✅[^4] |
| Admin launches a low-integrity executable | It runs at low | Minimum of user and file level ✅[^4] |
| Disabled group SID in a token | Ignored in the check | Only enabled groups count ✅[^3] |

## Takeaways
- Prefer allow-only DACLs built on groups; use deny ACEs sparingly and keep them first. [rule-candidate]
- Use a standard-user account day to day and elevate per task, as UAC intends.
- When access is denied, check in order: which token (elevated or not), integrity level, then the DACL walk.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 26 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Access Tokens](https://learn.microsoft.com/en-us/windows/win32/secauthz/access-tokens) — Microsoft Learn, living. Backs: token creation at logon, contents, primary vs impersonation tokens. [^1]
- [Security Identifiers](https://learn.microsoft.com/en-us/windows/win32/secauthz/security-identifiers) — Microsoft Learn, living. Backs: SID definition, issuing authority, well-known SIDs. [^2]
- [How DACLs Control Access to an Object](https://learn.microsoft.com/en-us/windows/win32/secauthz/how-dacls-control-access-to-an-object) — Microsoft Learn, living. Backs: no-DACL grant, ordered ACE evaluation and stop conditions, enabled groups only, importance of order, worked example shape. [^3]
- [Mandatory Integrity Control](https://learn.microsoft.com/en-us/windows/win32/secauthz/mandatory-integrity-control) — Microsoft Learn, living. Backs: four levels, who gets which, no-write-up example, unlabeled = medium, minimum of user and file level, SACL label ACE. [^4]
- [How User Account Control works](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/user-account-control/how-it-works) — Microsoft Learn, living. Backs: two tokens for admins, explorer.exe inheritance, consent and credential prompts, same integrity level for inheritance. [^5]
- No Windows lab was available when this doc was written (macOS host); the DACL example follows the documented algorithm.
- [Privilege Constants](https://learn.microsoft.com/en-us/windows/win32/secauthz/privilege-constants) — Microsoft Learn, living. Backs: `SeBackupPrivilege` (read regardless of ACL), `SeDebugPrivilege`. [^6]

## Related
- `linux/fundamentals/users-and-permissions.md` — UIDs and mode bits.
- `linux/security/lsm-and-landlock.md` — mandatory access control on Linux.
