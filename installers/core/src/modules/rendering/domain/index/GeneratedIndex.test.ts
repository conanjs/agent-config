import { describe, expect, it } from 'vitest';
import { renderGeneratedIndex } from '#rendering/domain/index/GeneratedIndex.ts';

describe('AC-16.4 FR-046 the generated index', () => {
  const text = renderGeneratedIndex();

  it('states what is rendered, from where, and that edits belong in the source', () => {
    expect(text).toContain('When a component is rendered');
    expect(text).toContain('None is rendered before phase 5');
    expect(text).toContain('Generated from `<source path>`; edit that file, not this copy.');
    expect(text).toContain('global-variables.md');
    expect(text).toMatch(/Edit the source, not the copy/);
  });

  it('is the same text every time, holds no agent-home placeholder (RC-5) and ends with one line ending', () => {
    expect(renderGeneratedIndex()).toBe(text);
    expect(text).not.toContain('{{AGENT_HOME}}');
    expect(text.endsWith('.\n')).toBe(true);
  });
});
