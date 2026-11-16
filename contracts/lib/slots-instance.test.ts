// The shipped contracts/slots.yaml against the one rule table of the citation classifier (specs/022 T058, QA follow-up of T056):
// the mounts the file declares, plus the generated global-variables.md, are exactly the rules every consumer classifies with.
// Test titles start with the ids they prove: SL-4 (slots-v1.md) and AC-1.4 (spec.md).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sharedLocationRules } from './citation-cases.ts';
import { locationRulesFromSlots, type LocationRule } from './citations.ts';
import { readContract } from './reader.ts';
import { readYaml } from './yaml.ts';

const slotsFile = path.resolve(import.meta.dirname, '..', 'slots.yaml');
const text = fs.readFileSync(slotsFile, 'utf8');

const globalVariables: LocationRule = { slot: 'core', location: 'global-variables', mount: 'global-variables.md' };
const byMount = (a: LocationRule, b: LocationRule): number => a.mount.localeCompare(b.mount);

describe('SL-4 contracts/slots.yaml and the shared citation rules', () => {
  it('the mounts of slots.yaml plus the global-variables rule are the shared location rules, in any order', () => {
    const read = readYaml(text);
    expect(read.ok).toBe(true);
    const rules = locationRulesFromSlots(read.ok ? read.value : null, [globalVariables]);
    expect([...rules].sort(byMount)).toEqual([...sharedLocationRules].sort(byMount));
  });

  it('AC-1.4 the shipped file is read with no error and no warning', () => {
    expect(readContract('slots/v1', text)).toEqual({ errors: [], warnings: [] });
  });
});
