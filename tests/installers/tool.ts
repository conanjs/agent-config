// tool.ts — steps of tests/installers/golden.feature (specs/022 T038): list the install plan of the old bash installers
// with tests/installers/golden/posix/plan.sh and compare it with a recorded golden file.
// The shared steps "the output has the line …" read `world.result`, so the plan listing is stored there.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Given, Then, When } from '@cucumber/cucumber';
import { repo } from '../support/tools.mjs';
import type { ToolWorld } from '../support/tools.ts';

const planScript = 'tests/installers/golden/posix/plan.sh';
const goldenDir = path.join(repo, 'tests', 'installers', 'golden');

/** What a plan listing leaves in the World; `plan` is the exact stdout, `out` the same without the final line break. */
type PlanWorld = ToolWorld & { result?: { code: number; out: string; plan?: string } };

/** Lists the plan with the plan.sh found under `repoRoot`, which locates the installers and mapping.yaml from its own path. */
function listPlan(world: PlanWorld, repoRoot: string, os: string): void {
  // GIT_* variables of an outer git command stay out of the child, as in the shared steps.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const plan = execFileSync('bash', [path.join(repoRoot, planScript), os], { encoding: 'utf8', env });
  world.result = { code: 0, out: plan.trimEnd(), plan };
}

Given('a copy of the old installers and their mapping in {string}', function (this: PlanWorld, dir: string) {
  // plan.sh derives the repo from its own location and reads installers/ and mapping.yaml there.
  for (const entry of ['installers', 'mapping.yaml', planScript]) {
    const to = path.join(this.at(dir), entry);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(path.join(repo, entry), to, { recursive: true });
  }
  // The installer opens every mapping source, so each top-level source folder or file is a link to the real one.
  const mapping = fs.readFileSync(path.join(repo, 'mapping.yaml'), 'utf8');
  const tops = new Set([...mapping.matchAll(/source: *([^,\s]+),/g)].map((m) => (m[1] ?? '').split('/')[0] ?? ''));
  for (const top of tops) fs.symlinkSync(path.join(repo, top), path.join(this.at(dir), top));
});

When("the old installers' plan for {string} is listed", function (this: PlanWorld, os: string) {
  listPlan(this, repo, os);
});

When(
  "the old installers' plan in {string} for {string} is listed",
  function (this: PlanWorld, dir: string, os: string) {
    listPlan(this, this.at(dir), os);
  },
);

// The Windows twin of plan.sh (T037): plan.ps1 runs install.ps1 with a private home and lists the same lines.
When('the plan of install.ps1 is listed on the Windows runner', function (this: PlanWorld) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const script = path.join(repo, 'tests/installers/golden/windows/plan.ps1');
  const plan = execFileSync('pwsh', ['-NoProfile', '-File', script], { encoding: 'utf8', env });
  this.result = { code: 0, out: plan.trimEnd(), plan };
});

/** Line ends are compared as \\n: PowerShell on Windows writes \\r\\n and a Windows checkout may convert the golden file. */
const lf = (text: string): string => text.replace(/\r\n/g, '\n');

function golden(file: string): string {
  return lf(fs.readFileSync(path.join(goldenDir, file), 'utf8'));
}

Then('the plan equals the golden file {string}', function (this: PlanWorld, file: string) {
  assert.ok(this.result?.plan !== undefined, 'no plan has been listed');
  assert.equal(lf(this.result.plan), golden(file), `the plan differs from tests/installers/golden/${file}`);
});

Then('the plan differs from the golden file {string}', function (this: PlanWorld, file: string) {
  assert.ok(this.result?.plan !== undefined, 'no plan has been listed');
  assert.notEqual(
    this.result.plan,
    golden(file),
    `the plan equals tests/installers/golden/${file}, but a change was expected to show`,
  );
});
