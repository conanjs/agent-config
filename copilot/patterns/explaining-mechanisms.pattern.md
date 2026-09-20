# Pattern: Explaining Multi-Actor Mechanisms

**Use when:** explaining anything where more than one actor/component acts in sequence — an auth flow, a build pipeline, a request lifecycle, a cross-service integration, a multi-account Git/SSH push mechanism (e.g. "how does a host alias route a push to the right GitHub account?"). Not for single-actor explanations (one function, one config value) — the structure below is overhead those don't need.

## The method

1. **State the actor count up front, then list each actor one per line (bullets or a numbered list — never inline in one paragraph).** Each line's purpose must be **one simple, positive clause using the same template for every actor** — "**Actor** — its job: \<what it's responsible for>, via \<the channel/tool, a few words max>." State only what it *does*; save what it *doesn't* know/handle for the step-by-step walkthrough, where there's room to explain why that absence matters — cramming both into one upfront clause answers two questions at once and reads as confusing rather than orienting. The "via" tag here is a short pointer, not the full explanation — that belongs in rule 3.
2. **Show the real artifacts involved, not descriptions of them.** A config file, a URL string, a request payload — paste the actual shape, not "a config file with the settings." If a string contains a piece a reader would otherwise have to decode themselves (which substring is an alias, which is a path, which is a literal keyword), parse it explicitly, piece by piece.
3. **Walk through the steps in sequence with explicit ownership prefixes per step** (e.g. "Git (local): ...", "SSH → GitHub: ..."). **"Who does what, via which" applies at the level of every distinct action, not once per step.** If a step (or an actor-summary line) describes two or more separate things happening, each one gets its own channel — a channel named for the *last* clause of a compound sentence does not cover the clauses before it. When a step has more than one distinct action, use sub-bullets rather than one dense sentence, so each action's channel is visibly attached to it, not just inferable. Name the exact channel/mechanism each action happens through — the real command, file, or protocol, not a paraphrase. Verify the channel against the real thing (a real config file, a real command's actual behavior) rather than the most plausible-sounding guess — a display/diagnostic command (e.g. `git remote -v`) is not the same as the internal mechanism it merely shows you. Also **mark the boundary between local/internal work and any network or cross-system call explicitly** — readers need to know when something has actually left the machine/process vs. when it's still local setup.
4. **Include a diagram of the mechanism** (ASCII or Mermaid) in addition to the numbered steps — a diagram and a step list serve different purposes (shape at a glance vs. detail); neither substitutes for the other.
5. **Add a numbered timeline only if the mechanism is complex enough to need it** — many steps, branching/conditional paths, timing-sensitive behavior. A judgment call, not reflexive. Extra step-level *detail* (more artifacts, more parsing) doesn't by itself mean a timeline is needed — that's a *depth* problem the diagram + steps already solve; a timeline is for *branching or timing* specifically.

## Worked example

*(From the conversation this pattern was extracted from — explaining how a repo pushes to a personal GitHub account via an SSH host alias, without touching the work account.)*

**3 actors:**
- **Git** — its job: start the push, via you running `git push`, and point to where, via the `origin` URL in `.git/config`.
- **SSH** — its job: pick the right identity, via the host alias in `~/.ssh/config`, then connect, via the SSH protocol.
- **GitHub** — its job: identify who connected, via the presented key, then check access, via its own repo-permissions.

**The artifact — `~/.ssh/config`, exactly as it sits on disk:**
```
Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes
```

**The other artifact — the remote URL, and where it actually came from:**
`git remote -v` shows:
```
origin  git@github-personal:conanjs/agent-config.git (push)
```
This wasn't retyped for this push — it was set **once**, earlier, with `git remote add origin git@github-personal:conanjs/agent-config.git`, and Git remembers it in this repo's own `.git/config` from then on.

**Parsing that string — what each piece actually is:**
`git@github-personal:conanjs/agent-config.git` breaks into three parts:
- `git@` — the SSH *username*. GitHub's convention: you always connect as the literal user `git`, regardless of which human account you are — identity comes from the *key*, not this username.
- `github-personal` — the *host* (between `@` and `:`). This is the alias piece, not a real address.
- `conanjs/agent-config.git` — the *path* on GitHub's side (owner/repo).

**Diagram:**
```
[Git — local]                  [SSH — local]                    [GitHub — remote]
git push
  │
  ├─ reads origin from .git/config
  │  (set once via `git remote add`)
  │
  ├─ extracts host "github-personal"
  │  from git@github-personal:...
  │
  └──────────────────▶ looks up "github-personal"
                         in ~/.ssh/config:
                           HostName: github.com (real)
                           IdentityFile: id_ed25519_personal
                           IdentitiesOnly: yes
                              │
                              │  ═══════ network boundary ═══════
                              ▼
                         SSH handshake — proves possession
                         of id_ed25519_personal
                         (private key itself never sent)
                              │
                              ▼
                                                          looks up: which account
                                                          owns this public key?
                                                          → conanjs
                                                               │
                                                               ▼
                                                          checks conanjs' access to
                                                          conanjs/agent-config
                                                               │
                                                               ▼
                                                            accept
```

**Steps, with LOCAL vs. NETWORK explicit:**

1. **Git (local):**
   - Triggered by you running `git push`.
   - Reads the `origin` URL, via this repo's own `.git/config` (`[remote "origin"]`, set once earlier by `git remote add` — **not** via `git remote -v`, which only *displays* this same data for a human; it's not what `push` reads internally).
   - Extracts the host portion, `github-personal`, from that URL string.
   - Hands that host string to SSH, via invoking the system's `ssh` program as a subprocess.
   - Nothing has left the machine yet. Git itself has no concept of "which account" — that's entirely SSH's and GitHub's problem, not Git's; this is why the trick works at all.

2. **SSH (local, before any network call):**
   - Looks up `github-personal`, via this machine's `~/.ssh/config`.
   - Substitutes the real destination and key, via that `Host` block's `HostName` and `IdentityFile` fields specifically.
   - Still entirely local.

3. **SSH → GitHub (the actual network handshake):**
   - Opens a connection to the real `github.com` — *only now* does anything leave the machine — via a standard SSH/TCP connection.
   - Proves key possession, via the SSH public-key authentication handshake (a signed challenge; the private key itself is never transmitted).

4. **GitHub (remote):**
   - Matches the presented key to an account, via its own registry of public keys registered under each account's Settings → SSH keys.
   - Checks push access, via its own repo-permissions system (`conanjs` owns `conanjs/agent-config`, so this is trivially satisfied here).
   - Accepts.

*(No timeline here — 4 linear steps, no branching, no timing-sensitivity. The richness above is detail-depth, which the diagram + steps already carry; that's not what a timeline is for.)*

**A separate, earlier mechanism — how commit authorship got embedded:**

Not part of the push flow above; it already happened once, when the commit was created. When `git commit` ran, Git read `user.name`/`user.email` from its own config system (this repo's local `[user]` section in `.git/config`, which overrides the global one) and wrote those values into the new commit object itself — the `author` field, permanently, as part of the data that gets hashed into that commit's SHA.

`git push` does **not** re-read `user.name`/`user.email` or "transfer" them as a step of its own — by the time a push happens, the commit object is already complete and immutable. Push just relays the already-finished object (author info baked in) over the SSH connection covered above. This is exactly why, in this repo, `user.email` had to be corrected *before* running `git commit` — fixing it only after committing (but before pushing) would have changed nothing about that already-created commit; push doesn't touch authorship at all, it only moves what commit already decided.

## Lessons

Real misses caught while using this pattern, so they don't repeat:

**Lesson 1 (2026-09-20):** First draft of a worked example for this exact SSH/Git/GitHub topic stated *what* happens at each step without showing the actual artifacts involved (the config file's real contents, the real remote URL) or parsing non-obvious substrings within them. It read as correct but abstract — a reader couldn't map it onto their own screen. Fix: rule 2 above (show real artifacts, parse non-obvious pieces explicitly) was added directly because of this miss.

**Lesson 2 (2026-09-20):** Second draft's "actor count + purpose" line packed all actors inline into one paragraph separated by "·", and each purpose crammed together what an actor *does* with an aside about what it *doesn't* know/handle, in one dense clause (e.g. "Git (initiates the push; knows nothing about accounts, just needs a connection)"). Confusing on both counts — hard to scan, and answering two different questions in one breath. Fix: rule 1 above now requires one actor per line and a fixed "**Actor** — its job: X" template, positive-only; the "doesn't know/handle" nuance moved into the step-by-step walkthrough instead, where there's room to explain why the absence matters.

**Lesson 3 (2026-09-20):** Third draft named *what* each step does but not the exact channel/mechanism it happens through (e.g. "reads the remembered origin" — via what, exactly?). Worse, the first attempt at adding that would have named `git remote -v` as the mechanism — plausible-sounding, but wrong: that's a human-facing display command, not what `push` actually reads internally (the real answer, checked against this repo's actual `.git/config`, is the `[remote "origin"]` url field). Separately, the whole explanation never covered how commit authorship (`user.name`/`user.email`) gets attached at all — a real content gap, not just a missing "via." Fix: rule 3 now requires naming the real channel per step and verifying it against the actual artifact rather than the most plausible guess; the worked example gained a dedicated "separate, earlier mechanism" section for commit authorship, explicitly marked as happening at commit time, not push time — conflating the two would have been its own inaccuracy.

**Lesson 4 (2026-09-20):** Fourth draft added a channel per step, but only once per step — a compound sentence describing two or more distinct actions got exactly one "via," attached to whichever clause came last, leaving earlier clauses in the same sentence unexplained (e.g. "start the push and say where to connect, via the `origin` URL" — the "via" only covers "say where to connect"; "start the push" itself — triggered by running `git push` — never got its own channel). This happened in the actor-summary line *and* several steps, not just the one place it was first caught. Fix: rule 3 now states explicitly that "who does what, via which" applies per distinct action, not once per step/bullet, and requires sub-bullets once a step has more than one distinct action rather than a single dense sentence covering all of them.

## References

**Local artifacts:**
- `copilot/knowledge/git/multi-account-ssh-identity.md` — the full topic this pattern's worked example is drawn from.
- `copilot/instructions/personal-defaults.instructions.md` — the short pointer rule that sends an agent here.

## Related

- `index.md` — the catalog this pattern is listed in.
- `shared-procedure-thin-wrapper.pattern.md`, `backup-before-overwrite.pattern.md` — the other two patterns here; same reasoning for existing as a pattern rather than inline instructions-file text.
