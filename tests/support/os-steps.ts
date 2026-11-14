// os-steps.ts — steps of tests/cucumber-config/cucumber-config.feature, written in TypeScript to prove that
// tests/support/*.ts loads by type stripping and that the OS tags of cucumber.mjs select scenarios.
import assert from 'node:assert/strict';
import { Then } from '@cucumber/cucumber';

Then('the operating system is {string}', function (expected: string) {
  assert.equal(process.platform, expected);
});

Then('the operating system is not {string}', function (unexpected: string) {
  assert.notEqual(process.platform, unexpected);
});

Then('a tool.ts file has been loaded', function () {
  assert.equal((globalThis as { toolTsLoaded?: boolean }).toolTsLoaded, true);
});
