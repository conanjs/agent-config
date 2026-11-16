import { describe, expect, it } from 'vitest';
import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';

// Digests from FIPS 180-4 example values and the empty input, written out so the test does not use the code under test.
const vectors: [title: string, input: string, digest: string][] = [
  ['the empty text', '', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
];

describe('sha256Hex', () => {
  it.each(vectors)('hashes %s', (_title, input, digest) => {
    expect(sha256Hex(input)).toBe(digest);
  });

  it('hashes bytes the same as the text they spell', () => {
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(sha256Hex('abc'));
  });

  it('gives 64 lower-case hex characters and a different digest for different text', () => {
    expect(sha256Hex('a')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });

  it('refuses a text with a lone surrogate, which would hash like another such text', () => {
    expect(() => sha256Hex('a\ud800')).toThrow(RangeError);
    expect(() => sha256Hex('a\udc00')).toThrow(RangeError);
  });

  it('hashes a surrogate pair as the character it spells', () => {
    expect(sha256Hex('\ud83d\ude00')).toBe(sha256Hex(new TextEncoder().encode('\u{1F600}')));
  });
});
