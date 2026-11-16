// LK-1 to LK-4, DR-205, M-17: `components.lock` is read through the contract reader, written with sorted keys, and a newer major is
// refused instead of rewritten.
import { describe, expect, it } from 'vitest';
import {
  emitComponentsLock,
  parseComponentsLock,
  type ComponentsLock,
} from '#state/domain/components/ComponentsLock.ts';

const lock: ComponentsLock = {
  components: {
    notes: {
      source: { type: 'path', path: '/h/src/notes' },
      resolved: { live: true, path: '/h/src/notes' },
      manifest: { version: '0.3.0', slot: 'framework', contracts: ['framework/v1'] },
      build: null,
      store_id: '0123456789ab',
    },
    kb: {
      source: { type: 'git', url: 'https://example.invalid/kb.git', ref: 'main' },
      resolved: { commit: '9c1d5e7a2b4f60813d9ce5a7b1f20486c3d7e951' },
    },
  },
};

describe('LK-4 the text of components.lock', () => {
  it('is sorted by key and ends in a line feed', () => {
    const text = emitComponentsLock(lock);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.indexOf('"kb"')).toBeLessThan(text.indexOf('"notes"'));
    expect(text.indexOf('"components"')).toBeLessThan(text.indexOf('"schema"'));
  });

  it('is the same text for the same lock, whatever the insertion order', () => {
    const reversed: ComponentsLock = { components: Object.fromEntries(Object.entries(lock.components).reverse()) };
    expect(emitComponentsLock(reversed)).toBe(emitComponentsLock(lock));
  });

  it('reads back what it wrote', () => {
    expect(parseComponentsLock(emitComponentsLock(lock))).toEqual({ ok: true, value: lock });
  });
});

describe('DR-205, M-17 a lock that is refused', () => {
  const valid = emitComponentsLock(lock);
  it.each([
    ['empty', ''],
    ['not JSON', 'components: {}'],
    ['truncated', valid.slice(0, valid.length / 2)],
    ['an array', '[]'],
    ['no components', '{"schema":"components-lock/v1"}'],
    [
      'a component with no resolved',
      '{"schema":"components-lock/v1","components":{"kb":{"source":{"type":"path","path":"/x"}}}}',
    ],
    ['a bad component name', valid.replace('"kb"', '"../kb"')],
    ['a short commit', valid.replace('9c1d5e7a2b4f60813d9ce5a7b1f20486c3d7e951', '9c1d5e7')],
    ['a source with a password', valid.replace('https://example.invalid/kb.git', 'https://u:p@example.invalid/kb.git')],
    ['a wrong schema', valid.replace('components-lock/v1', 'components-lock/v0')],
  ])('refuses %s as corrupt, without quoting it', (_title, text) => {
    const result = parseComponentsLock(text);
    expect(result.ok === false && result.error.kind).toBe('corrupt');
    expect(JSON.stringify(result)).not.toContain('hunter');
  });

  it('refuses a newer major and says it is not rewritten', () => {
    const result = parseComponentsLock(valid.replace('components-lock/v1', 'components-lock/v2'));
    expect(result.ok === false && result.error.kind).toBe('newer-major');
  });
});
