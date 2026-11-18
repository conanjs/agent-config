// FR-022, AC-5.6, AC-5.10: which links of a Markdown file are citations of another component, and which slot each points into.
import { describe, expect, it } from 'vitest';
import { citationMounts, citationsOf, citationTexts } from '#commands/application/install/CitationScan.ts';

const slots = {
  slots: [
    {
      name: 'knowledge-storage',
      reserved: false,
      contracts: ['knowledge-provider/v1'],
      required: false,
      multiple: false,
      scope: 'global' as const,
      selfContained: true,
      locations: [{ name: 'content', mount: 'knowledge', required: true, shared: false, index: 'provided' as const }],
    },
  ],
};

describe('citation texts', () => {
  it('finds the link texts that start with the placeholder, and nothing else', () => {
    const text = [
      'See [{{AGENT_HOME}}/knowledge/a/b.md](https://x.invalid/b.md) and [own](docs/own.md).',
      'Also [{{AGENT_HOME}}/knowledge/c.md](https://x.invalid/c.md), and plain {{AGENT_HOME}}/knowledge/d.md.',
    ].join('\n');
    expect(citationTexts(text)).toEqual(['{{AGENT_HOME}}/knowledge/a/b.md', '{{AGENT_HOME}}/knowledge/c.md']);
  });

  it('skips fenced code blocks', () => {
    const text =
      '```\n[{{AGENT_HOME}}/knowledge/a.md](x)\n```\n[{{AGENT_HOME}}/knowledge/b.md](y)\n~~~\n[{{AGENT_HOME}}/knowledge/c.md](z)\n~~~\n';
    expect(citationTexts(text)).toEqual(['{{AGENT_HOME}}/knowledge/b.md']);
  });
});

describe('citations of a component', () => {
  const mounts = citationMounts(slots);

  it('lists the mounts of slots/v1 and the generated variables file', () => {
    expect(mounts.map((mount) => mount.mount)).toEqual(['knowledge', 'global-variables.md']);
  });

  it('gives each distinct citing file and cited path once, with its slot', () => {
    const files = [
      { file: 'docs/guide.md', text: '[{{AGENT_HOME}}/knowledge/a/b.md](x) [{{AGENT_HOME}}/knowledge/a/b.md](x)' },
      { file: 'docs/other.md', text: '[{{AGENT_HOME}}/knowledge/a/b.md](x) [{{AGENT_HOME}}/global-variables.md](y)' },
      { file: 'docs/none.md', text: '[{{AGENT_HOME}}/nowhere/x.md](x) [{{AGENT_HOME}}/knowledge/<topic>/x.md](y)' },
    ];
    expect(citationsOf('sdlc-x', files, mounts)).toEqual([
      { consumer: 'sdlc-x', file: 'docs/guide.md', slot: 'knowledge-storage', locationPath: 'knowledge/a/b.md' },
      { consumer: 'sdlc-x', file: 'docs/other.md', slot: 'knowledge-storage', locationPath: 'knowledge/a/b.md' },
      { consumer: 'sdlc-x', file: 'docs/other.md', slot: 'core', locationPath: 'global-variables.md' },
    ]);
  });
});
