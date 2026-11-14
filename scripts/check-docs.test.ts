// Pins the spec 022 steps of scripts/check-docs.sh (T086): each step must be present and its failure must set status=1, so
// removing a step, or making it pass whatever it finds, fails here. Test titles start with the id they prove (QB-7 mutation
// proof, decisions/qa.md; AC-1.2 schema check; AC-1.6 fitness; QB-1 coverage; FR-012 layout).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const script = fs.readFileSync(path.join(import.meta.dirname, 'check-docs.sh'), 'utf8');
const lines = script.split('\n').filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));

/** The one command line that runs `needle`, so a step that moved or was removed shows as a missing line. */
function stepLine(needle: string): string {
  const found = lines.filter((line) => line.includes(needle));
  expect(found, `a line running ${needle}`).toHaveLength(1);
  return found[0] ?? '';
}

const setsFailure = /\|\|\s*(?:\{[^}]*)?status=1/;

describe('QB-7 the spec 022 steps of check-docs.sh', () => {
  it('AC-1.2 runs the schema check over the index, the slots file and the valid examples, and a failure sets status=1', () => {
    const line = stepLine('contracts/tools/check-schemas.ts');
    for (const input of ['contracts/index.md', 'contracts/slots.yaml', 'contracts/*/v1/examples/valid/*']) {
      expect(line).toContain(input);
    }
    expect(line).toMatch(setsFailure);
  });

  it('AC-1.6 runs the fitness check and a failure sets status=1', () => {
    const line = stepLine('scripts/check-fitness.ts');
    expect(line).toContain('--root "$root"');
    expect(line).toMatch(setsFailure);
  });

  it('QB-1 runs the coverage check for phase 0 and a failure sets status=1', () => {
    const line = stepLine('scripts/check-ac-coverage.ts');
    expect(line).toContain('--delivered 0');
    expect(line).toMatch(setsFailure);
  });

  it('FR-012 runs the layout check in report mode and a failure sets status=1', () => {
    const line = stepLine('contracts/tools/build.ts');
    expect(line).toContain('layout --report');
    expect(line).toMatch(setsFailure);
  });

  it('runs prettier, eslint, tsc and vitest in one chain over the repo and a failure sets status=1', () => {
    const line = stepLine('node_modules/prettier/bin/prettier.cjs --check --log-level warn .');
    for (const tool of [
      'prettier.cjs --check',
      'eslint.js . --max-warnings 0',
      'tsc --noEmit -p tsconfig.json',
      'vitest.mjs run',
    ]) {
      expect(line).toContain(tool);
    }
    // Chained with && so the first failure stops the rest and the whole chain sets the status.
    expect(line.match(/&&/g)?.length).toBeGreaterThanOrEqual(3);
    expect(line).toMatch(setsFailure);
  });

  it('runs the Cucumber scenarios last and a failure sets status=1', () => {
    expect(stepLine('"$node_bin" "$cucumber"')).toMatch(setsFailure);
    expect(lines.at(-1)).toBe('exit $status');
  });
});
