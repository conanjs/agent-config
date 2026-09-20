# Multi-Account Git/SSH Identity (No Manual Switching)

**Status:** Verified by direct use, not just reading docs — this exact setup was built and confirmed working in this session (`ssh -T git@github-personal` authenticated correctly, a real push to a personal GitHub repo succeeded, commit author was confirmed correct before and after push).

## The problem this solves

One machine, two GitHub accounts (e.g. a work account and a personal one). Naively, SSH only associates **one** identity with the hostname `github.com` — whichever key it finds first. Using a second account then means either manually swapping which key is active (`ssh-add`, `gh auth switch`, etc.) before every push/pull, or risking a push authenticated as — or a commit authored as — the wrong account. Forgetting to switch back is the actual failure mode, not a hypothetical one.

## The concept, with an analogy

An SSH `Host` alias in `~/.ssh/config` is a **contact card with a nickname**, local to your machine only. Imagine two phone contacts both labeled "Mom" — one is your real mom, one is a coworker nicknamed that as a joke. Tapping a contact card dials whatever *number* is stored inside it, not whatever the *label* says. `github-personal` works the same way: it's a nickname that exists only in `~/.ssh/config`. Something asks to connect to "github-personal" → your machine looks up that nickname → finds *"actually call github.com, and show ID badge #2, not badge #1."* GitHub's servers never see the word "github-personal" — they only ever see a normal connection to `github.com`, plus whichever key was presented.

## The concrete artifact

```
# ~/.ssh/config
Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes
```

`IdentitiesOnly yes` matters — without it, SSH may still offer your *other* (default) key first, defeating the whole point.

## The mechanism, step by step (who does what)

1. **Git (local):** `origin` is set to `git@github-personal:conanjs/agent-config.git` (a normal `git remote add`). On `git push`, Git parses out the host — `github-personal` — and hands the connection job to the local `ssh` program. Git itself has no concept of "which account" — it just needs *a* connection.
2. **SSH (local, before any network traffic):** Looks up `github-personal` in `~/.ssh/config`, finds the `Host` block, and substitutes: real destination = `github.com`, only acceptable key = `id_ed25519_personal`. This substitution happens entirely on-machine.
3. **SSH → GitHub (the handshake):** SSH connects to the real `github.com` and cryptographically proves possession of the private key matching `id_ed25519_personal` — the private key is never transmitted, only proof of holding it. GitHub checks which account has that exact public key registered (Settings → SSH keys) and identifies the connection as that account.
4. **GitHub:** Now knowing which account this is, checks push/pull permission on the target repo accordingly.

## The subtle, independent second system

Steps 1–4 only answer *"is this connection allowed to push?"* (authentication/authorization). A **completely separate** system answers *"whose name goes on the commit?"* — `user.name`/`user.email`, read from git's own config, unrelated to SSH entirely.

These two don't know about each other. In this session's actual setup, the SSH key correctly authenticated as the personal account, but the local `user.email` had *not* been overridden and was still inheriting the work email from global git config — a real, caught-before-pushing bug: SSH would have let the push through as the right account, while the commit itself still said the wrong email. **Both** need setting for real separation:

```bash
cd /path/to/the/repo
git config user.name "Personal Name"     # LOCAL (no --global) — only affects this repo
git config user.email "personal@email.com"
```

## Full setup, as a repeatable checklist

1. Generate a dedicated key (don't reuse an existing one whose account affiliation is uncertain): `ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_<label> -N "" -C "<label>"`
2. Add the resulting `.pub` file's contents to the target GitHub account's Settings → SSH and GPG keys (the account must actually be logged in on the GitHub website when doing this).
3. Add a `Host` block to `~/.ssh/config` as above.
4. Verify before doing anything else: `ssh -T git@<host-alias>` — should greet you by the expected username. (Exit code 1 with a "successfully authenticated" message is GitHub's normal response for this test — not an error.)
5. `git remote add origin git@<host-alias>:<username>/<repo>.git` for the target repo.
6. Set **local** (not global) `user.name`/`user.email` in that repo, per above.
7. Re-verify identity before the first push: `git config user.name`, `git config user.email`, and `git log -1 --format="%an <%ae>"` if a commit already exists.

## Why this beats manually switching accounts

A plain `git@github.com:...` URL (no alias) always falls back to whatever the *default* SSH identity is — meaning every repo using that literal hostname shares one identity, and using a second account means actively overriding it each time. The host-alias approach moves the "switch" out of every individual push and into a one-time choice baked into which remote URL a given repo uses. Nothing to remember, nothing to forget.

## References

**Local artifacts:**
- `~/.ssh/config` — the actual `Host github-personal` block on this machine.
- `agent-config` repo, `origin` remote — the worked instance this was built for.

**External authoritative sources:**
- [GitHub Docs — Managing multiple accounts](https://docs.github.com/en/account-and-profile/how-tos/account-management/managing-multiple-accounts) — official guidance on this exact scenario, confirms the `~/.ssh/config` approach and its `GIT_SSH_COMMAND`/`IdentitiesOnly=yes` alternative.
- [OpenSSH `ssh_config` manual — `Host` and `IdentitiesOnly`](https://man.openbsd.org/ssh_config) — authoritative behavior for the config directives used here.

## Related

- `{{AGENT_HOME}}/global-variables.md` — a different, unrelated multi-machine-identity problem (path variables, not credentials) solved with a different mechanism (seed-once file, not SSH aliasing) — worth contrasting if the two ever get confused.
