// MOD-11: the composer fills the port in. The state-backed writer is the composition root's job (rendering may not import state), so
// a recording writer stands in here.
import { describe, expect, it } from 'vitest';
import { composeRendering } from '#rendering/RenderingModule.ts';
import type { GeneratedRelativePath } from '#rendering/application/ports/GeneratedFileWriter.ts';

describe('MOD-11 the rendering composer', () => {
  it('plans the two files and writes them through the writer it was given', () => {
    const written: [GeneratedRelativePath, string][] = [];
    const api = composeRendering({
      writer: {
        write: (name, text) => {
          written.push([name, text]);
          return { ok: true, value: { path: `/h/.agent-config/${name}` } };
        },
      },
    });
    const plan = api.planVariablesFiles({ home: '/h/.agent-config', declared: [], values: new Map() });
    if (!plan.ok) throw new Error('plan refused');
    const result = api.writeGeneratedFiles(plan.value);
    expect(result.ok && result.value.map((file) => file.path)).toEqual([
      '/h/.agent-config/generated/global-variables.md',
      '/h/.agent-config/generated/index.md',
    ]);
    expect(written).toEqual(plan.value.map((file) => [file.relativePath, file.text]));
  });
});
