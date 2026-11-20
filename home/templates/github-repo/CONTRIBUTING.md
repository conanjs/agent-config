# Contributing to <REPO_NAME>

Thanks for taking the time to contribute.

## Before you start

- Check open [issues](../../issues) and [pull requests](../../pulls) first — avoid duplicate work.
- For a change bigger than a small fix (new feature, breaking change, structural rework), open an issue to discuss the approach before writing code. Saves both sides a wasted PR.

## Making a change

1. Fork the repo (or branch directly, if you have write access).
2. Branch off the default branch: `git checkout -b <type>/<short-description>` (e.g. `fix/broken-symlink-check`, `feat/windows-installer`).
3. Make the change. Keep the diff scoped to one logical change — unrelated cleanup belongs in its own PR.
4. Write a clear commit message: a short summary line, a blank line, then the *why* if it isn't obvious from the diff.
5. Push and open a pull request against the default branch.

## Pull request expectations

- Describe what changed and why, not just what — the diff already shows *what*.
- Link the issue it resolves, if any (`Closes #123`).
- Keep PRs small and reviewable. A PR that does five unrelated things is five PRs.
- Be responsive to review feedback — an open PR with no activity for a long time may be closed and can always be reopened.

## Code style

Match the existing conventions in the file/module you're touching. If the repo has a linter/formatter configured, run it before pushing.

## Code of Conduct

This project follows [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Participation means agreeing to abide by it.

## Reporting a security issue

Do **not** open a public issue for security vulnerabilities — see [`SECURITY.md`](SECURITY.md) instead.

## References

**Local artifacts:**
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), [`SECURITY.md`](SECURITY.md), [`CODEOWNERS`](CODEOWNERS) — the other governance files this one cross-references.

**External authoritative sources:**
- [GitHub Docs — Setting guidelines for repository contributors](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors) — what a `CONTRIBUTING.md` is for and how GitHub surfaces it.

## Related

- [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md), [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/) — the structured forms this guide points contributors toward.
