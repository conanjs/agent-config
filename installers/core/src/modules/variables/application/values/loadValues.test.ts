// M-17, M-08: reading V's values file through the ports; the YAML reader is a double that returns what the real one would.
import { describe, expect, it } from 'vitest';
import { loadValues } from '#variables/application/values/loadValues.ts';
import type { VariablesFileStore } from '#variables/application/ports/VariablesFileStore.ts';
import type { YamlReader } from '#variables/application/ports/YamlReader.ts';

const storeOf = (text: string | undefined | 0): VariablesFileStore => ({
  readText: () =>
    Promise.resolve(text === 0 ? { ok: false, error: { kind: 'unreadable' } } : { ok: true, value: text }),
});
const json: YamlReader = (text) => ({ ok: true, value: JSON.parse(text) as unknown });
const refusing: YamlReader = () => ({
  ok: false,
  findings: [
    { code: 'X', message: 'a tag is not allowed', line: 3 },
    { code: 'Y', message: 'too deep', line: undefined },
  ],
});

describe('loading V values', () => {
  it('treats a missing file as no values', async () => {
    expect(await loadValues({ store: storeOf(undefined), readYaml: json })).toEqual({ ok: true, value: new Map() });
  });

  it('reads the values', async () => {
    const text = JSON.stringify({ schema: 'variables-local/v1', values: { LANGUAGE: 'English' } });
    expect(await loadValues({ store: storeOf(text), readYaml: json })).toEqual({
      ok: true,
      value: new Map([['LANGUAGE', 'English']]),
    });
  });

  it('M-17 reports each YAML finding with its line and never the text', async () => {
    const result = await loadValues({ store: storeOf('S3CRET'), readYaml: refusing });
    expect(result).toEqual({
      ok: false,
      error: { kind: 'invalid-yaml', sentence: 'line 3: a tag is not allowed; too deep' },
    });
  });

  it('refuses an unreadable file', async () => {
    const result = await loadValues({ store: storeOf(0), readYaml: json });
    expect(result.ok === false && result.error.kind).toBe('unreadable');
  });

  it('M-08 refuses a file that holds a secret-like value, whole', async () => {
    const text = JSON.stringify({ schema: 'variables-local/v1', values: { A: 'ghp_S3CRET' } });
    const result = await loadValues({ store: storeOf(text), readYaml: json });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('S3CRET');
  });
});
