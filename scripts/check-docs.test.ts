// Pins the spec 022 steps (T086), which live in scripts/check-new-tiers.sh and run from scripts/check-docs.sh: each step must
// be present and its failure must set status=1, so
// removing a step, or making it pass whatever it finds, fails here. Test titles start with the id they prove (QB-7 mutation
// proof, decisions/qa.md; AC-1.2 schema check; AC-1.6 fitness; QB-1 coverage; FR-012 layout).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** The command lines of a script, without blank lines and comments. */
function commandLines(file: string): string[] {
  const text = fs.readFileSync(path.join(import.meta.dirname, file), 'utf8');
  return text.split('\n').filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));
}

const lines = commandLines('check-new-tiers.sh');
const docsLines = commandLines('check-docs.sh');

/** The one command line that runs `needle`, so a step that moved or was removed shows as a missing line. */
function stepLine(needle: string): string {
  const found = lines.filter((line) => line.includes(needle));
  expect(found, `a line running ${needle}`).toHaveLength(1);
  return found[0] ?? '';
}

const setsFailure = /\|\|\s*(?:\{[^}]*)?status=1/;

describe('QB-7 the spec 022 steps of check-new-tiers.sh', () => {
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
    expect(line).toContain('--delivered 0,1');
    expect(line).toMatch(setsFailure);
  });

  it('FR-012 runs the layout check in report mode and a failure sets status=1', () => {
    const line = stepLine('contracts/tools/build.ts layout');
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

  it('AC-9.1 runs the SDLC validator with the knowledge root and the adapter map, and a failure sets status=1', () => {
    const found = docsLines.filter((l) => l.includes('agentic-sdlc/tools/validate.mjs'));
    expect(found).toHaveLength(1);
    const line = found[0] ?? '';
    expect(line).toContain('--knowledge "$root/copilot/knowledge"');
    expect(line).toContain('--adapters "$root/adapters.json"');
    expect(line).toMatch(setsFailure);
  });

  it('AC-9.1 runs build cite in check mode over the fixture tree (no --write) and a failure sets status=1', () => {
    const line = stepLine('contracts/tools/build.ts cite');
    expect(line).toContain('tests/build-cite/fixtures/base');
    expect(line).toContain('--slots "$root/contracts/slots.yaml"');
    expect(line).not.toContain('--write');
    expect(line).toMatch(setsFailure);
  });

  it('AC-9.1 the upstream check of the workflow passes the same two arguments', () => {
    const workflow = fs.readFileSync(
      path.join(import.meta.dirname, '..', '.github', 'workflows', 'validate-docs.yml'),
      'utf8',
    );
    const upstream = workflow.split('\n').filter((l) => l.includes('agentic-sdlc/tools/validate.mjs'));
    expect(upstream).toHaveLength(1);
    expect(upstream[0]).toContain('--knowledge copilot/knowledge --adapters adapters.json');
  });

  it('runs the spec 022 scenarios unless --no-scenarios, and a failure sets status=1', () => {
    const line = stepLine('--profile spec022');
    expect(line).toMatch(setsFailure);
    expect(lines.at(-1)).toBe('exit $status');
  });

  it('check-docs.sh runs it without scenarios, then every scenario last, and a failure sets status=1', () => {
    const call = docsLines.filter((line) => line.includes('scripts/check-new-tiers.sh'));
    expect(call).toHaveLength(1);
    expect(call[0]).toContain('--no-scenarios');
    expect(call[0]).toMatch(setsFailure);
    const cucumber = docsLines.filter((line) => line.includes('"$node_bin" "$cucumber"'));
    expect(cucumber).toHaveLength(1);
    expect(cucumber[0]).toMatch(setsFailure);
    expect(docsLines.at(-1)).toBe('exit $status');
  });
});
