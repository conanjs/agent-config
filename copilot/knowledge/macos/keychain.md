---
schema: knowledge-doc/v1
type: how-to
topic: macos
status: verified
applies-to: ["macOS 26.1", "security(1) as shipped with macOS 26.1", "OpenSSH_10.0p2 (Apple build)", "git 2.50.1 (Command Line Tools)"]
last-verified: 2026-11-05
last-updated: 2026-11-05
tags: [macos, keychain, security-cli, secrets, git-credential, osxkeychain, ssh, usekeychain, passwords-app]
---

# Store and read secrets from scripts with the macOS Keychain

## Summary
**TL;DR:** Put a script's secret in your login keychain with `security add-generic-password -a "$USER" -s <service> -U -w` (typing the value at the prompt), read it at run time with `security find-generic-password -a "$USER" -s <service> -w`, and pass it straight to the command that needs it. Git (`credential-osxkeychain`) and SSH (`UseKeychain`) can use the same keychain, so no secret has to sit in shell history, dotfiles or exported variables.
**Use this when:** a script, `Makefile` or tool needs a token or password on a Mac and you want it out of `.env` files, `~/.zshrc` and shell history.
**Not this doc:** app permission prompts (camera, files, automation) → `tcc-privacy-permissions.md`; code signatures that keychain trust depends on → `gatekeeper-and-code-signing.md`.

## Goal & prerequisites
- **End state:** a secret is stored once in the login keychain under a service name you choose, scripts read it on demand, Git and SSH use the keychain too, and nothing secret is left in files or history.
- **Plain-English picture:** a keychain is a locked drawer that opens when you log in. Each item is a labelled envelope: the *service* (`-s`) and *account* (`-a`) are written on the outside and are searchable; the secret inside is encrypted. Concrete artifact: the login keychain file `~/Library/Keychains/login.keychain-db` ✅[^14].
- **Which keychain:**

| Keychain | What it holds | Where |
|---|---|---|
| Login (your default) | Your items; created for each user ✅[^2]; unlocked by your login password, which it matches ✅[^5] | `~/Library/Keychains/login.keychain-db`, the default here ✅[^14] |
| System | Items that are not per user, such as network credentials and PKI (public key infrastructure) identities ✅[^2] | `/Library/Keychains/System.keychain` ✅[^14] |
| iCloud Keychain | Passwords, passkeys, card data and Wi-Fi passwords synced across your Apple devices ✅[^6] | Managed through your Apple Account; not in `security list-keychains` here ✅[^14] |
| Passwords app | Where macOS now shows all passwords, passkeys and verification codes; Keychain Access is mainly for certificates ✅[^3] | `/System/Applications/Passwords.app` ✅[^14]; user guide ✅[^7] |

- **Needs:** macOS's built-in `security` tool (no install), an interactive terminal for the prompt, and a fake service name to practise with, e.g. `kb-probe-2026-11-05`.

## Steps
1. List the keychains a search will use:
   ```sh
   security list-keychains
   ```
   Expect your login keychain and `/Library/Keychains/System.keychain` ✅[^14].
2. Store the secret, letting `security` prompt for it. `-w` placed last asks for the value (Apple's man page calls this "recommended"); `-U` updates the item if it already exists ✅[^1]:
   ```sh
   security add-generic-password -a "$USER" -s my-api-token -U -w
   ```
   Do **not** write `-w 'the-secret'` on the command line: any process of yours can read command arguments with `ps` (a test process started as `perl -e 'sleep 2' kb-fake-arg` showed `kb-fake-arg` in `ps -o command=`) ✅[^14], and zsh saves the line to history unless it starts with a space and `HIST_IGNORE_SPACE` is set ✅[^12].
3. Read it in a script and hand it directly to the command, without `export`:
   ```sh
   token="$(security find-generic-password -a "$USER" -s my-api-token -w)" || exit 1
   printf 'Authorization: Bearer %s\n' "$token" | curl -sS -H @- https://api.example.com/v1/me
   ```
   `-w` prints only the secret ✅[^1]. `printf` is a builtin in zsh and bash ✅[^14], so the token never appears in a command line; `curl -H @-` reads the header from standard input ✅[^16]. Avoid `export token`: exported variables show in `ps -E` (process environment) ✅[^13], which displayed VS Code's environment here ✅[^14].
4. For internet-style items (a server rather than a service name), use the matching command: `security find-internet-password -s <server> -a <account> -w` ✅[^1].
5. Let Git keep HTTPS credentials in the keychain. With Apple's Command Line Tools this is already on: the system Git config sets `credential.helper=osxkeychain` ✅[^14]. Elsewhere, enable it:
   ```sh
   git config --global credential.helper osxkeychain
   ```
   The `osxkeychain` helper stores credentials in your account's keychain instead of a plain-text file ✅[^8] ✅[^9].
6. Let SSH keep key passphrases in the keychain. In `~/.ssh/config`:
   ```text
   Host *
     UseKeychain yes
     AddKeysToAgent yes
   ```
   `UseKeychain` (default `no`) looks passphrases up in the keychain and stores a newly typed one there ✅[^10]; `AddKeysToAgent yes` loads the key into `ssh-agent` on first use ✅[^10]. To store a passphrase once by hand: `ssh-add --apple-use-keychain ~/.ssh/id_ed25519` ✅[^11]. The old `-K`/`-A` flags were renamed to these `--apple-*` options ✅[^11].

## Verify
Run the full cycle on a throwaway item (fake value, fake service name) and remove it:
```sh
security add-generic-password -a kbprobe -s kb-probe-2026-11-05 -w 'fake-value-1' -U   # fake value, test only
security find-generic-password -s kb-probe-2026-11-05 -w     # → fake-value-1, exit 0
security delete-generic-password -s kb-probe-2026-11-05      # → "password has been deleted."
security find-generic-password -s kb-probe-2026-11-05        # → "could not be found", exit 44
```
On 2026-11-05 this printed exactly those results; adding the same item again without `-U` failed with "already exists" and exit 45, and with `-U` it replaced the value ✅[^14]. No access prompt appeared, because the app that creates an item (`security` here) is trusted to read it ✅[^1]. Running `find-generic-password` without `-w` or `-g` lists the attributes (`acct`, `svce`, dates) ✅[^14]; only `-g` or `-w` display the secret ✅[^1].

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Exit 44, "The specified item could not be found" | No item matches the `-s`/`-a` you gave ✅[^14] | Check spelling; `-a` must match if you pass it |
| Exit 45, "already exists in the keychain" | `add-…-password` without `-U` on an existing item ✅[^14] | Add `-U` ✅[^1] |
| A dialog asks to allow access, with **Allow Once**, **Always Allow**, **Deny** | The item was created by a different app, so `security` is not yet trusted for it ✅[^1]; Keychain Access asks before giving the password out ✅[^4] | Allow Once for a single run; Always Allow only for tools you trust ✅[^4] |
| The dialog comes back after an update | A changed or updated app loses its earlier trust and must be allowed again ✅[^15] | Allow again if you just updated; otherwise suspect the app ✅[^15] |
| Script waits forever at `password data for new item:` | `-w` with no value prompts; with no real terminal (piped input) nothing answers. A piped test here hung until killed ✅[^14] | Run the store step by hand in Terminal; scripts should only read |
| Keychain asks for its own password at login, or items are unreadable | The login password was reset by an administrator, so it no longer matches the keychain password ✅[^5] | Use the old password, or create a new keychain if it is lost ✅[^5] |
| Every app can read the item without asking | It was created with `-A` ✅[^1] | Delete and re-create without `-A`; use `-T <app path>` to allow specific apps ✅[^1] |

## Rollback
- Delete a script secret: `security delete-generic-password -a "$USER" -s my-api-token` ✅[^1].
- Undo the global Git helper setting added in step 5: `git config --global --unset credential.helper`. If a helper was configured before step 5, restore its previous value. The Command Line Tools system setting still applies ✅[^14].
- Remove a stored SSH passphrase: `ssh-add -d --apple-use-keychain ~/.ssh/id_ed25519` ✅[^11], then set `UseKeychain no`.

## Takeaways
- Store with `-w` last (prompted), read with `-w`, and never export the value. [rule-candidate]
- Use a dedicated service name per secret so scripts read and delete exactly one item.
- A secret in an exported variable is visible to `ps -E`; a secret in a command line is visible to `ps`. Pipe it through standard input instead.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 48 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-05

## References
- `man security | col -b` on this Mac (macOS 26.1) — security(1). Backs: `add-generic-password` options (`-w` last prompts, recommended; `-U`; `-A` insecure; `-T`), the creating app is trusted by default, `find-*-password -w`, `delete-generic-password`. [^1]
- [Keychain data protection](https://support.apple.com/guide/security/keychain-data-protection-secb0694df1a/web) — Apple Platform Security, living. Backs: a default keychain per user, system-level keychains, access control lists. [^2]
- [What is Keychain Access on Mac?](https://support.apple.com/guide/keychain-access/what-is-keychain-access-kyca1083/mac) — Apple, living. Backs: Passwords app holds passwords, passkeys and codes; Keychain Access manages certificates. [^3]
- [If you're asked for access to your keychain on Mac](https://support.apple.com/guide/keychain-access/if-youre-asked-for-access-to-your-keychain-kyca1243/mac) — Apple, living. Backs: the Allow Once / Always Allow / Deny prompt. [^4]
- [About your keychain password](https://support.apple.com/guide/keychain-access/about-your-keychain-password-mchlp1086/mac) — Apple, living. Backs: keychain password follows the login password; admin reset breaks the match. [^5]
- [Set up iCloud Keychain](https://support.apple.com/en-us/109016) — Apple, living. Backs: what iCloud Keychain syncs. [^6]
- [Passwords User Guide](https://support.apple.com/guide/passwords/welcome/mac) — Apple, living. Backs: the Passwords app. [^7]
- [Git Tools - Credential Storage](https://git-scm.com/book/en/v2/Git-Tools-Credential-Storage) — Pro Git, Scott Chacon and Ben Straub, living. Backs: `osxkeychain` stores credentials in the account's keychain. [^8]
- [gitcredentials](https://git-scm.com/docs/gitcredentials) — Git project, living. Backs: `git-credential-osxkeychain` as the macOS helper. [^9]
- `man ssh_config | col -b` on this Mac (OpenSSH_10.0p2) — ssh_config(5). Backs: `UseKeychain` (default `no`), `AddKeysToAgent`. [^10]
- `man ssh-add | col -b` on this Mac (OpenSSH_10.0p2) — ssh-add(1). Backs: `--apple-use-keychain`, `--apple-load-keychain`, renamed from `-K`/`-A`. [^11]
- `man zshoptions | col -b` on this Mac (zsh 5.9) — zshoptions(1). Backs: `HIST_IGNORE_SPACE`. [^12]
- `man ps | col -b` on this Mac (macOS 26.1) — ps(1). Backs: `-E` displays the environment. [^13]
- Local test on this Mac, 2026-11-05 (macOS 26.1 build 25B78, arm64): `security list-keychains`, `security default-keychain`; throwaway item `kb-probe-2026-11-05` (fake values) created, read, updated with and without `-U`, attributes listed, deleted, and confirmed absent (exit 44); a piped prompted add hung and was stopped, and the item was confirmed absent afterwards; `ps -o command=` on a test process; `ps -E` on VS Code's main process; `git config --show-origin --get-all credential.helper`; `whence -w printf` (zsh) and `type printf` (bash). No real secret was read. [^14]
- [If a Mac app you've already trusted asks for keychain access](https://support.apple.com/guide/keychain-access/if-a-trusted-app-asks-for-keychain-access-kyca1331/mac) — Apple, living. Backs: changed or updated apps must be re-allowed. [^15]
- `man curl | col -b` on this Mac (curl 8.7.1) — curl(1). Backs: `-H @-` reads headers from standard input. [^16]

## Related
- `macos/tcc-privacy-permissions.md` — the other kind of macOS permission prompt.
- `macos/gatekeeper-and-code-signing.md` — app identity, which keychain trust is tied to.
- `macos/launchd-services-and-environment.md` — why secrets in environment variables spread to child processes.
- `git/multi-account-ssh-identity.md` — SSH keys per Git account.
