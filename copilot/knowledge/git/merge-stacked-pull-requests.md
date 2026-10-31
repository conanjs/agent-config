---
schema: knowledge-doc/v1
type: how-to
topic: git
status: verified
applies-to: ["GitHub.com pull requests", "gh CLI (tested 2026-10-31)"]
last-verified: 2026-10-31
last-updated: 2026-10-31
tags: [github, pull-requests, stacked-prs, gh, branch-deletion, retarget]
---

# Merging stacked pull requests into main

## Summary
**TL;DR:** In a stack, each pull request targets the branch of the one below it. Merge them bottom-up, and **move each next PR onto `main` yourself before deleting any branch**. GitHub's docs say that deleting a merged PR's branch retargets the PRs built on it. In practice, `gh pr merge --delete-branch` closed the next PR instead (tested 2026-10-31, and reported by others).
**Use this when:** merging PR #2 that targets PR #1's branch, and so on; cleaning up branches after a stacked merge; a stacked PR closed by surprise.
**Not this doc:** writing or reviewing stacked changes.

## Goal & prerequisites

**End state:** every PR in the stack is merged into `main` with its own merge commit, and its branch is deleted. No PR is left closed unmerged.

**Prerequisites:**
- `gh` signed in with merge rights.
- The PRs, bottom to top. Example: #1 `feat/a` → `main`, #2 `feat/b` → `feat/a`, #3 `feat/c` → `feat/b`.
- **Merge commits, not squash.** Each upper PR already contains the PRs below it, so a squashed lower PR would make the upper PRs show those changes again.

## Steps

1. Merge the bottom PR, **keeping its branch**:
   ```bash
   gh pr merge 1 --merge
   ```
2. Move the next PR onto `main`:
   ```bash
   gh pr edit 2 --base main
   ```
3. Wait for the required checks, which run again after the base changes:
   ```bash
   gh pr checks 2 --watch
   ```
4. Merge it:
   ```bash
   gh pr merge 2 --merge
   ```
5. Repeat steps 2–4 for each PR above.
6. Check that no open PR targets a branch you are about to delete:
   ```bash
   gh pr list --state open --json number,baseRefName
   ```
7. Delete the merged branches, for example:
   ```bash
   gh api -X DELETE repos/<owner>/<repo>/git/refs/heads/feat/a
   ```

## Verify

```bash
gh pr list --state all --limit 5 --json number,state,baseRefName
```

Expected: every PR in the stack is `MERGED` with base `main`. `git log --oneline origin/main` shows one merge commit per PR.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| PR #2 shows **Closed** right after `gh pr merge 1 --merge --delete-branch` | Deleting #1's branch closed the PR that targeted it instead of retargeting it. Seen here on 2026-10-31, and in [cli/cli#14223](https://github.com/cli/cli/issues/14223) ✅[^cli14223]. GitHub's docs describe the opposite (automatic retargeting) ✅[^ghdocs] | Recreate the deleted branch at its old head (`gh pr view 1 --json headRefOid`, then `gh api -X POST repos/<o>/<r>/git/refs -f ref=refs/heads/feat/a -f sha=<sha>`). Then `gh pr reopen 2` and `gh pr edit 2 --base main`. Tested 2026-10-31: #2 reopened, retargeted, passed its checks and merged. The issue reporter could not reopen; there the branch had changed |
| PR shows `BLOCKED` after retargeting | The required check runs again for the new base | `gh pr checks <n> --watch`, then merge |
| PR shows `CONFLICTING` against a deleted base | Its base branch no longer exists | As in the first row |
| An upper PR shows the lower PRs' changes again after a squash merge | Squash makes new commits; the upper branch still has the originals | Use merge commits for stacks, or rebase the upper branch onto `main` |

## Rollback

A merge into `main` is undone with a revert PR: `git revert -m 1 <merge-commit>`, pushed through the normal checks. A branch deleted by mistake is restored at its old head SHA (first troubleshooting row).

## Takeaways
- Retarget the next stacked PR before deleting the branch below it; never rely on automatic retargeting. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 2 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-31
- Tested 2026-10-31 on this repo's PRs #1–#3 with `gh`: the close, the recovery and the order in Steps.

## References
- [GitHub Docs: Creating and deleting branches within your repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-and-deleting-branches-within-your-repository) — GitHub, living; read 2026-10-31. Backs: what the docs promise (retargeting after a merged PR's branch is deleted). [^ghdocs]
- [cli/cli#14223](https://github.com/cli/cli/issues/14223) — GitHub CLI issue tracker. Backs: the stacked PR closed after `gh pr merge --delete-branch`. [^cli14223]
- [gh pr merge](https://cli.github.com/manual/gh_pr_merge), [gh pr edit](https://cli.github.com/manual/gh_pr_edit) — GitHub CLI manual. The commands in Steps.
- `TRACKER.md` T-1, `specs/015-tracker/` — the merge this was learned on.

## Related
- `git/multi-account-ssh-identity.md`
