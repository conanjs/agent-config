import { describe, expect, it } from 'vitest';
import { planVariablesFiles } from '#rendering/application/generated/planVariablesFiles.ts';
import { writeGeneratedFiles } from '#rendering/application/generated/writeGeneratedFiles.ts';
import type {
  GeneratedFileWriter,
  GeneratedRelativePath,
  GeneratedWriteRefusal,
} from '#rendering/application/ports/GeneratedFileWriter.ts';
import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';
import type { ComponentName } from '#shared/domain/name/NameRules.ts';
import { succeed } from '#shared/domain/result/Result.ts';
import type {
  PublicDeclaredVariable,
  PublicVariableName,
  PublicVariableValue,
} from '#variables/application/VariablesTypes.ts';

const declare = (name: string, description: string, component: string): PublicDeclaredVariable => ({
  name: name as PublicVariableName,
  description,
  required: false,
  detect: undefined,
  declaredBy: [component as ComponentName],
});
const declared = [
  declare('ALPHA_ROOT', 'Folder of alpha files', 'vars-a'),
  declare('BETA_NAME', 'Name of beta', 'vars-a'),
  declare('GAMMA_DIR', 'Folder of gamma files', 'vars-a'),
  declare('DELTA_HOME', 'Home of delta', 'vars-b'),
];
const values = new Map([
  ['ALPHA_ROOT', '/data/alpha'],
  ['BETA_NAME', 'beta'],
  ['GAMMA_DIR', '/data/gamma'],
  ['DELTA_HOME', '/data/delta'],
  ['OFF_ONLY', 'x'],
] as [PublicVariableName, PublicVariableValue][]);

function tableRowsOf(text: string): string[] {
  const lines = text.split('\n');
  const header = lines.indexOf('| Variable | Value | Description | Declared by |');
  return lines.slice(header + 2).filter((line) => line.startsWith('|'));
}

describe('AC-6.2 VR-1 M-08 the plan of the variables file', () => {
  it('gives exactly 4 rows plus AGENT_HOME for two components with 3 and 1 variables, none for OFF_ONLY', () => {
    const plan = planVariablesFiles({ home: '/r/home/.agent-config', declared, values });
    const file = plan.ok
      ? plan.value.find((planned) => planned.relativePath === 'generated/global-variables.md')
      : undefined;
    expect(tableRowsOf(file?.text ?? '')).toEqual([
      '| AGENT_HOME | /r/home/.agent-config | Folder of the agent home | agent-config |',
      '| ALPHA_ROOT | /data/alpha | Folder of alpha files | vars-a |',
      '| BETA_NAME | beta | Name of beta | vars-a |',
      '| GAMMA_DIR | /data/gamma | Folder of gamma files | vars-a |',
      '| DELTA_HOME | /data/delta | Home of delta | vars-b |',
    ]);
  });

  it('shows a value as V stored it (AC-6.4: ~/ws/ref stays ~/ws/ref)', () => {
    const plan = planVariablesFiles({
      home: '/h',
      declared: [declare('REF_ROOT', 'Folder of references', 'vars-detect')],
      values: new Map([['REF_ROOT' as PublicVariableName, '~/ws/ref' as PublicVariableValue]]),
    });
    expect(plan.ok && tableRowsOf(plan.value[0]?.text ?? '')[1]).toBe(
      '| REF_ROOT | ~/ws/ref | Folder of references | vars-detect |',
    );
  });

  it('pins both planned paths below the home, so the journal and the writer use one path', () => {
    const plan = planVariablesFiles({ home: '/h', declared, values });
    expect(plan.ok && plan.value.map((file) => file.relativePath)).toEqual([
      'generated/global-variables.md',
      'generated/index.md',
    ]);
  });

  it('plans the index second and hashes each text, so the journal can record the writes', () => {
    const plan = planVariablesFiles({ home: '/h', declared, values });
    expect(plan.ok && plan.value.map((file) => file.relativePath)).toEqual([
      'generated/global-variables.md',
      'generated/index.md',
    ]);
    expect(plan.ok && plan.value.every((file) => file.hash === sha256Hex(file.text))).toBe(true);
  });

  it('is deterministic: the same input gives the same bytes and hashes', () => {
    expect(planVariablesFiles({ home: '/h', declared, values })).toEqual(
      planVariablesFiles({ home: '/h', declared, values }),
    );
  });

  it('refuses a value that needs redaction and never puts it in the result', () => {
    const plan = planVariablesFiles({
      home: '/h',
      declared: [declare('LINK', 'd', 'c')],
      values: new Map([['LINK' as PublicVariableName, 'https://user:hunter2@example.com/' as PublicVariableValue]]),
    });
    expect(plan.ok).toBe(false);
    expect(JSON.stringify(plan)).not.toContain('hunter2');
  });
});

describe('MOD-11 writing the plan', () => {
  const memoryWriter = (
    refuse?: GeneratedRelativePath,
    refusal: GeneratedWriteRefusal = { kind: 'is-link' },
  ): { writer: GeneratedFileWriter; files: Map<string, string> } => {
    const files = new Map<string, string>();
    const writer: GeneratedFileWriter = {
      write(relativePath, text) {
        if (relativePath === refuse) return { ok: false, error: refusal };
        files.set(`/h/${relativePath}`, text);
        return succeed({ path: `/h/${relativePath}` });
      },
    };
    return { writer, files };
  };
  const planned = () => {
    const plan = planVariablesFiles({ home: '/h', declared, values });
    if (!plan.ok) throw new Error('plan refused');
    return plan.value;
  };

  it('writes both files in order and returns their paths and hashes', () => {
    const plan = planned();
    const { writer, files } = memoryWriter();
    expect(writeGeneratedFiles(writer, plan)).toEqual({
      ok: true,
      value: plan.map((file) => ({
        relativePath: file.relativePath,
        path: `/h/${file.relativePath}`,
        hash: file.hash,
      })),
    });
    expect([...files.keys()]).toEqual(['/h/generated/global-variables.md', '/h/generated/index.md']);
  });

  it('stops at the first refusal and tries nothing after it', () => {
    const { writer, files } = memoryWriter('generated/global-variables.md');
    expect(writeGeneratedFiles(writer, planned())).toEqual({
      ok: false,
      error: { relativePath: 'generated/global-variables.md', refusal: { kind: 'is-link' } },
    });
    expect(files.size).toBe(0);
  });

  it('keeps the first file when the index is refused, and names the index', () => {
    const plan = planned();
    const { writer, files } = memoryWriter('generated/index.md', { kind: 'not-a-file' });
    expect(writeGeneratedFiles(writer, plan)).toEqual({
      ok: false,
      error: { relativePath: 'generated/index.md', refusal: { kind: 'not-a-file' } },
    });
    expect([...files.keys()]).toEqual(['/h/generated/global-variables.md']);
    expect(files.get('/h/generated/global-variables.md')).toBe(plan[0]?.text);
  });

  it('passes on the outside refusal with its reason', () => {
    const { writer } = memoryWriter('generated/global-variables.md', {
      kind: 'outside',
      reason: 'the path leaves the home',
    });
    expect(writeGeneratedFiles(writer, planned())).toEqual({
      ok: false,
      error: {
        relativePath: 'generated/global-variables.md',
        refusal: { kind: 'outside', reason: 'the path leaves the home' },
      },
    });
  });
});
