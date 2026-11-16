import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import localDocs from './local-docs.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2024, sourceType: 'module' } });
const rule = localDocs.rules['specific-summary'];

const clear = '/** Rejects a manifest whose name repeats an earlier entry. */';
const vague = '/** Applies one step. */';

tester.run('local-docs/specific-summary', rule, {
  valid: [
    { code: `${clear}\nexport const rejectRepeat = () => 1;` },
    { code: `${clear}\nexport const rejectRepeat = function () { return 1; };` },
    { code: `${clear}\nexport function rejectRepeat() { return 1; }` },
    { code: 'export const undocumented = () => 1;' },
  ],
  invalid: [
    { code: `${vague}\nexport const applyStep = () => 1;`, errors: [{ messageId: 'vague' }] },
    { code: `${vague}\nexport const applyStep = function () { return 1; };`, errors: [{ messageId: 'vague' }] },
    { code: `${vague}\nconst applyStep = () => 1;`, errors: [{ messageId: 'vague' }] },
  ],
});
