// The two adapters on a real folder, and M-18 as a text check on the probe: it names no module that runs a command.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileVariablesFileStore } from '#variables/infrastructure/FileVariablesFileStore.ts';
import { nodeDetectProbe } from '#variables/infrastructure/NodeDetectProbe.ts';

let root = '';
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'variables-infra-'));
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('the values file store', () => {
  it('reads a regular file', async () => {
    const file = path.join(root, 'values.yaml');
    fs.writeFileSync(file, 'schema: variables-local/v1\n');
    expect(await fileVariablesFileStore(file).readText()).toEqual({ ok: true, value: 'schema: variables-local/v1\n' });
  });

  it('answers undefined for a missing file', async () => {
    expect(await fileVariablesFileStore(path.join(root, 'missing.yaml')).readText()).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('refuses a folder', async () => {
    const result = await fileVariablesFileStore(root).readText();
    expect(result.ok).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('M-04 refuses a link, even to a readable file', async () => {
    const target = path.join(root, 'real.yaml');
    fs.writeFileSync(target, 'x');
    const link = path.join(root, 'link.yaml');
    fs.symlinkSync(target, link);
    expect((await fileVariablesFileStore(link).readText()).ok).toBe(false);
  });

  it('M-17 reads at most one byte over the YAML size limit', async () => {
    const file = path.join(root, 'big.yaml');
    fs.writeFileSync(file, 'a'.repeat(300_000));
    const result = await fileVariablesFileStore(file).readText();
    expect(result.ok && result.value?.length).toBe(262_145);
  });
});

describe('M-18 the detect probe', () => {
  it('reads an own environment entry and nothing inherited', () => {
    const probe = nodeDetectProbe({ EDITOR: 'vim' });
    expect(probe.environmentValue('EDITOR')).toBe('vim');
    expect(probe.environmentValue('toString')).toBeUndefined();
    expect(probe.environmentValue('MISSING')).toBeUndefined();
  });

  it('finds a folder and not a file or a missing path', async () => {
    fs.writeFileSync(path.join(root, 'afile'), 'x');
    const probe = nodeDetectProbe({});
    expect(await probe.directoryExists(root)).toBe(true);
    expect(await probe.directoryExists(path.join(root, 'afile'))).toBe(false);
    expect(await probe.directoryExists(path.join(root, 'nope'))).toBe(false);
  });

  it('M-18 the adapter names no module that can run a command', () => {
    const source = fs.readFileSync(path.join(import.meta.dirname, 'NodeDetectProbe.ts'), 'utf8');
    expect(source).not.toMatch(
      /child_process|node:process|\bexec(Sync|File)?\b\s*\(|\bspawn(Sync)?\b|\beval\b|new Function/,
    );
  });
});
