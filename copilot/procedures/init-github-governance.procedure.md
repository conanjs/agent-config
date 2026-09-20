# Procedure: Initialize GitHub Repo Governance

Tool-agnostic procedure for adding standard repo-lifecycle/contribution files to a repo that doesn't have them yet. Written once here; tool-specific wrappers should just point here rather than re-describing these steps.

**Inputs needed:**
- **target repo path** (optional) — defaults to the current repo (`git rev-parse --show-toplevel`).
- **owner GitHub username** (required) — fills `CODEOWNERS` and any `<OWNER_GITHUB_USERNAME>` placeholder.
- **contact email** (required) — fills `CODE_OF_CONDUCT.md`/`SECURITY.md`'s `<CONTACT_EMAIL>` placeholder. A private inbox the owner actually reads, not a placeholder address.
- **repo name** (optional) — defaults to the target repo's directory name; fills `<REPO_NAME>` in `CONTRIBUTING.md`.

## Steps

1. **Read the template source in full before copying anything** — `{{AGENT_CONFIG_REPO}}/templates/github-repo/` is the one canonical copy of every file this procedure places; don't reconstruct their content from memory or restate it here, and don't fork a second copy anywhere else.

2. **Confirm the target repo's working tree is clean** (`git status`) before making any change, same habit as every other procedure/installer in this repo — makes the change trivially revertable if something's wrong.

3. **Copy each template file into the target repo, preserving relative structure**: root-level files (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CODEOWNERS`) go to the target repo's root; `.github/*` files go under the target repo's own `.github/`.
   - **Skip any file that already exists** at the destination — this procedure adds a baseline, it does not overwrite existing governance content someone already wrote. Report each skip, same non-destructive stance as `init-repo-kb.procedure.md`.

4. **Replace every `<PLACEHOLDER>` token** in the copied files with the resolved inputs (`<REPO_NAME>`, `<OWNER_GITHUB_USERNAME>`, `<CONTACT_EMAIL>`). If an input wasn't supplied, ask for it rather than guessing or leaving the literal placeholder in place — a real repo's security policy pointing at `<CONTACT_EMAIL>` is worse than not having the file at all.

5. **Stage the new/changed files (`git add`) but do not commit** — per this repo's standing rule, committing on someone's behalf needs an explicit ask, every time, not just the first time.

6. **Present the settings checklist** — these are GitHub-side repository *settings*, not files, so they can't be committed and this procedure must never apply them silently:
   - Branch protection on the default branch: require pull request review before merging (≥1 approval; 2 for a sensitive/high-traffic repo), require status checks to pass before merging, block force-pushes, block branch deletion.
   - Optionally require CODEOWNERS review specifically (branch protection has a distinct toggle for this — CODEOWNERS alone only *suggests* reviewers, it doesn't block merging without it).
   - These can be set via the repo's Settings → Branches UI, or scripted with `gh api repos/<owner>/<repo>/branches/<branch>/protection` — show the exact command for the user's actual repo/branch, but **never run it without explicit confirmation first**: it's a shared, hard-to-reverse-in-effect GitHub setting (it changes what every future contributor can and can't do), not a local file edit.

7. **Report a summary**: files added, files skipped (already present, listed by path), and the settings checklist from step 6 still pending manual/confirmed action. Don't report the task as fully complete when settings are still outstanding — those are the part with actual enforcement teeth; the files alone are only documentation.

## What this procedure does NOT do

- **Choose or add a `LICENSE` file.** License choice is a legal/business decision belonging to the repo owner (permissive vs. copyleft vs. proprietary vs. none) — not something to default or assume silently.
- **Run branch-protection `gh api` calls automatically.** Always surfaced as a checklist + exact command, confirmed before running — see step 6.
- **Vendor a second copy of the template files anywhere else.** `templates/github-repo/` is their one home; if a target repo's copy needs customizing further, that customization happens in the target repo, not by forking the template.

## References

**Local artifacts:**
- `templates/github-repo/` — the actual file contents this procedure copies.
- `copilot/prompts/init-github-governance.prompt.md` — the Copilot-specific invokable wrapper for this procedure.
- `copilot/procedures/init-repo-kb.procedure.md` — the sibling procedure this one's shape (inputs, non-destructive copy, batch report) is modeled after.

**External authoritative sources:**
- [GitHub Docs — About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) — CODEOWNERS syntax and the "must also set branch protection" caveat referenced in step 6.
- [GitHub Docs — Managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule) — the exact settings named in step 6.

## Related

- `copilot/procedures/spec-driven-development.procedure.md` — the sibling procedure for bootstrapping a project's spec workflow; a brand-new personal repo will often want both.
- `copilot/patterns/backup-before-overwrite.pattern.md` — a related but different technique (this procedure *skips* pre-existing files rather than backing them up, since it's purely additive, never replacing).
