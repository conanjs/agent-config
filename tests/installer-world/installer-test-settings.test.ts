import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createScriptedTerminal,
  defaultNow,
  fixedClock,
  readTestSettings,
  reportedGitVersion,
  reportedNodeVersion,
} from '../support/installer-test-settings.ts';

describe('T117 test settings', () => {
  it('T117: with nothing set the clock is fixed, no terminal is attached, no fault and the real node version', () => {
    const settings = readTestSettings({});
    expect(settings.now.toISOString()).toBe(defaultNow);
    expect(settings.terminal.interactive).toBe(false);
    expect(settings.faults).toEqual([]);
    expect(reportedNodeVersion(settings)).toBe(process.version);
  });

  it('T117: empty variables count as unset', () => {
    const settings = readTestSettings({
      AGENT_CONFIG_TEST_NOW: '',
      AGENT_CONFIG_TEST_TERMINAL: '',
      AGENT_CONFIG_TEST_NODE_VERSION_COMMAND: '',
      AGENT_CONFIG_TEST_GIT_VERSION_COMMAND: '',
      AGENT_CONFIG_TEST_FAULT: '',
    });
    expect(settings.terminal.interactive).toBe(false);
    expect(settings.nodeVersionCommand).toBeUndefined();
    expect(settings.gitVersionCommand).toBeUndefined();
  });

  it('T117: reads every variable', () => {
    const settings = readTestSettings({
      AGENT_CONFIG_TEST_NOW: '2027-01-02T03:04:05.000Z',
      AGENT_CONFIG_TEST_TERMINAL: '["yes"]',
      AGENT_CONFIG_TEST_FAULT: 'links-denied',
    });
    expect(settings.now.toISOString()).toBe('2027-01-02T03:04:05.000Z');
    expect(settings.terminal.interactive).toBe(true);
    expect(settings.faults).toEqual([{ kind: 'links-not-permitted' }]);
  });

  it('T117: refuses a bad date-time, a bad terminal script and a bad fault', () => {
    expect(() => readTestSettings({ AGENT_CONFIG_TEST_NOW: 'yesterday' })).toThrow(/not a date-time/);
    expect(() => readTestSettings({ AGENT_CONFIG_TEST_TERMINAL: '{"a":1}' })).toThrow(/JSON array/);
    expect(() => readTestSettings({ AGENT_CONFIG_TEST_FAULT: 'nope' })).toThrow(/unknown fault/);
  });

  it('T117: the fixed clock gives a new Date each time with the same instant', () => {
    const clock = fixedClock(new Date(defaultNow));
    const first = clock.now();
    first.setUTCFullYear(1999);
    expect(clock.now().toISOString()).toBe(defaultNow);
  });

  it('T117: a scripted terminal answers in order, records the questions and never invents an answer', async () => {
    const terminal = createScriptedTerminal(['yes', 'no']);
    expect([await terminal.ask('a?'), await terminal.ask('b?')]).toEqual(['yes', 'no']);
    expect(terminal.asked).toEqual(['a?', 'b?']);
    await expect(terminal.ask('c?')).rejects.toThrow(/no answer for question 3/);
  });

  it('T117: an absent terminal cannot be asked', async () => {
    const terminal = createScriptedTerminal(null);
    expect(terminal.interactive).toBe(false);
    await expect(terminal.ask('a?')).rejects.toThrow(/no terminal is attached/);
  });

  it('T117: the node version command is run with --version and its output is trimmed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-version-'));
    try {
      const script = path.join(dir, 'v.mjs');
      fs.writeFileSync(script, "console.log(process.argv[2] === '--version' ? 'v23.1.0' : 'wrong');\n");
      expect(reportedNodeVersion({ nodeVersionCommand: script })).toBe('v23.1.0');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('T117: the git version command is run with --version, and without one the real git answers', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-version-'));
    try {
      const script = path.join(dir, 'g.mjs');
      fs.writeFileSync(script, "console.log(process.argv[2] === '--version' ? 'git version 2.50.1' : 'wrong');\n");
      expect(reportedGitVersion({ gitVersionCommand: script })).toBe('git version 2.50.1');
      expect(reportedGitVersion({ gitVersionCommand: undefined })).toMatch(/^git version /);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
