# Shallow Git Clones Break SonarQube's "New Code" Detection — Concept + Case Study

Generic knowledge about how CI checkout depth (`fetch-depth`) interacts with SCM-based
tools like SonarQube/SonarCloud, plus a concrete case study from PR #3363 in
`ne-api-gateway` (SonarCloud reported 20.4% duplicated "New Code" pointing at a file,
`master.module.ts`, that PR #3363's diff never touched).

---

## 1. First, a correction to a common misreading

**It is not "SonarQube fetches only the tip commit."** SonarQube/SonarCloud never talks
to `git fetch` at all — it only *reads* whatever `.git` directory is already sitting in
the CI job's workspace by the time the scan step runs. The thing that decides how much
history exists is an earlier, unrelated step: the checkout action
(`actions/checkout@v4` on GitHub Actions, equivalent steps on other CI systems).

So the chain of responsibility is:

1. **CI checkout step** (owns cloning) → decides how much git history lands on the
   runner's disk.
2. **Git repo on the runner** (just a plain `.git` dir, same as one on your laptop) →
   either has the full commit graph, or only a fragment of it, depending on #1.
3. **SonarSource scan action** (owns SCM/blame lookups) → runs `git` commands *against
   whatever #2 gave it* to compute per-line blame and the New Code diff.
4. **SonarCloud/SonarQube server** (owns the New Code decision) → if #3's blame data
   comes back incomplete, silently switches to a weaker fallback heuristic instead of
   failing loudly.

A bug at step 1 (shallow clone) breaks step 3, which breaks step 4 — but nothing about
Sonar itself is "only looking at the tip commit." It's simply handed a repo that only
*has* the tip commit.

---

## 2. `fetch-depth`, shallow clone, and "common history" — worked example

**`fetch-depth`** is a parameter on the checkout action controlling how many commits of
history to download:

- `fetch-depth: 1` (the default when unset) → download **only the tip commit** of the
  branch being checked out. Its tree (files) is complete, but its parent pointer is
  cut off — git calls this a **shallow clone**.
- `fetch-depth: 0` → download **the entire commit history**, same as a normal
  `git clone` with no `--depth` flag (a **full clone**).

### Concrete example with real dates

Say `master` in `ne-api-gateway` looks like this (each letter = one commit, arrows =
"parent of"):

```
master:  A (2026-01-10, adds master.module.ts) ── B ── C ── D (2026-09-08, tip of master)
```

A colleague branches off `master` at `D` on 2026-09-10 and adds one cherry-picked commit:

```
master:               A ── B ── C ── D (2026-09-08)
                                      \
PR branch (chore/…):                  E (2026-09-10, the cherry-picked cargo-release commit)
```

**Full clone (`fetch-depth: 0`):** the runner's local repo contains `A, B, C, D, E` and
all the parent links between them. Git can run
`git merge-base E origin/master` (origin/master pointing at `D`) and get back `D` — the
exact point where the branch split off. Diffing `D..E` then correctly produces *only*
the files `E` actually changed (the 5 cargo-release files). Sonar's blame lookup for
`master.module.ts` finds it was last touched in commit `A`, over a year ago on
`master` — **not new**.

**Shallow clone (`fetch-depth: 1`, the bug):** the runner's local repo contains
**only `E`**, as an isolated commit with no parent recorded at all (git literally
marks it as a "grafted" root — a shallow boundary). `origin/master` may also be
fetched shallow, landing as an unrelated single commit `D'` with no link back to `E`.
From the local repo's point of view, `E` and `D'` are two disconnected islands in the
commit graph — there is no path between them, so:

```
$ git merge-base E origin/master
fatal: no merge base found
```

This is what **"no common history to diff against"** means concretely: it's not that
the *content* is unrelated — `E`'s real parent *is* `D` — it's that the **local clone
never downloaded the edges of the graph** that would let git prove it. Git blame,
which walks parent commits backward to find when each line last changed, has nowhere
to walk to for any file — so per Sonar's own docs, blame retrieval is skipped entirely,
and the server falls back to comparing raw file content/timestamps against whatever it
last analyzed, which is what let a stale, already-duplicated file
(`master.module.ts`) get miscounted as part of the new PR's code.

### ASCII picture

```
Full clone (fetch-depth: 0):        Shallow clone (fetch-depth: 1):

  A─B─C─D                              D'   (isolated, no parents)
         \
          E   <- merge-base(E,D)=D      E    (isolated, no parents)
             diff D..E = real PR diff       no merge-base possible
```

---

## 3. Case study: PR #3363, `ne-api-gateway`

- **Symptom:** SonarCloud PR summary showed Quality Gate failed on Duplications
  (20.4% vs. ≤3.0% required), with `src/modules/master-data/master.module.ts` listed
  at 52.4% duplicated / 22 duplicated lines under "New Code."
- **Verified via `gh pr view 3363 --json files,commits`:** the PR's actual diff was 1
  commit, 5 files, all under `import-shipment/.../cargo-release*` — `master.module.ts`
  was nowhere in it.
- **Root cause found:** `.github/workflows/ci.yml`'s `unit-test` job (the job that
  runs `SonarSource/sonarqube-scan-action@v5`) used a bare `actions/checkout@v4` with
  no `fetch-depth`, i.e. the default shallow clone. Other jobs in the same repo
  (`cd.yml`, `gitleaks.yml`) already had `fetch-depth: 0` — this one job was just
  missed.
- **Fix:** add `fetch-depth: 0` to that one checkout step (see PR
  [ocean-network-express/ne-api-gateway#3365](https://github.com/ocean-network-express/ne-api-gateway/pull/3365)).
  Rolled out as its own standalone PR to `develop`, to be cherry-picked to `master`
  separately — deliberately *not* bundled into the unrelated cherry-pick PR, to avoid
  reintroducing the same "unrelated diff noise" problem this incident was about.
- **Secondary, separate finding:** the same job's `sonar.exclusions` arg contains
  `**/modules/import-shipment/**/*cargo-release*`, which matches all 5 files actually
  changed in PR #3363 — meaning the real diff wasn't even being analyzed by Sonar.
  Left open as a question for the team on whether that exclusion is intentional.

---

## 4. General checklist for any repo running SonarQube/SonarCloud in CI

- [ ] The checkout step feeding the Sonar scan job must use `fetch-depth: 0`. This is
      required for **any** SCM-blame-dependent tool (Sonar, some coverage-diff tools,
      `git blame`-based ownership dashboards) — not just Sonar.
- [ ] If a repo has multiple CI jobs each with their own checkout step, verify *all*
      of them, not just one — a fix applied to one job's checkout doesn't propagate to
      a sibling job's separate `actions/checkout` step.
- [ ] If a PR's Sonar "New Code" report lists a file that isn't in `git diff` /
      `gh pr view --json files`, treat that as a signal to check checkout depth first,
      before assuming the report or the PR is wrong.
- [ ] Prefer verifying via `gh pr view <n> --json files,commits` (ground truth diff)
      over trusting the Sonar UI's own "changed files" framing when the two disagree.

---

## References

- Local: [`ne-api-gateway/.github/workflows/ci.yml`](/Users/vinh.doq/workspace/ots-projects/ne-api-gateway/.github/workflows/ci.yml) — `unit-test` job, checkout step (fixed at line 94)
- Local: PR [ocean-network-express/ne-api-gateway#3363](https://github.com/ocean-network-express/ne-api-gateway/pull/3363) — the cherry-pick PR that surfaced the incident
- Local: PR [ocean-network-express/ne-api-gateway#3365](https://github.com/ocean-network-express/ne-api-gateway/pull/3365) — the `fetch-depth: 0` fix
- External: [SonarSource/sonarqube-scan-action README](https://github.com/SonarSource/sonarqube-scan-action) — "Disabling shallow clones is recommended for improving the relevancy of reporting"
- External: [SonarQube Server docs — SCM integration](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scm-integration/) — "A full Git clone is required. If a shallow clone is found, the blame information retrieval will be skipped"
- External: [GitHub `actions/checkout` — `fetch-depth` input](https://github.com/actions/checkout#usage) — documents the default (`1`) and the `0` = full history option

## Related

- [[dead-code-rules]] — another case where SCM/diff-based tooling (this repo's dead-code
  detection) depends on accurate git history; worth cross-checking if it hits similar
  shallow-clone artifacts
- CI/CD checkout conventions across `ne-api-gateway`, `ne-manage-shipment-frontend`,
  and sibling repos — worth a follow-up audit doc if more jobs turn out to have the
  same gap (not yet written)
