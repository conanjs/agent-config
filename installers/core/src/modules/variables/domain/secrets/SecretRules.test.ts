// M-08 secret-like names and values (VR-4): the lists of the contract, and the evasions a hostile value or name might try.
import { describe, expect, it } from 'vitest';
import { secretNameWord, secretValuePrefix } from '#variables/domain/secrets/SecretRules.ts';

describe('M-08 secret-like names', () => {
  it.each([
    ['GITHUB_TOKEN', 'TOKEN'],
    ['CLIENT_SECRET', 'SECRET'],
    ['DB_PASSWORD', 'PASSWORD'],
    ['MY_APIKEY', 'APIKEY'],
    ['MY_API_KEY', 'API_KEY'],
    ['github_token', 'TOKEN'],
    ['TOKEN_SECRET', 'TOKEN'],
    ['TOKENIZER_DIR', 'TOKEN'],
  ])('refuses %s for %s', (name, word) => {
    expect(secretNameWord(name)).toBe(word);
  });

  it.each(['LANGUAGE', 'OTS_REPOS_ROOT', 'API_HOME', 'KEY_FOLDER', 'PASS_DIR', ''])('accepts %j', (name) => {
    expect(secretNameWord(name)).toBeUndefined();
  });
});

describe('M-08 secret-like values', () => {
  it.each([
    ['ghp_0000FAKE', 'ghp_'],
    ['github_pat_0000FAKE', 'github_pat_'],
    ['sk-0000FAKE', 'sk-'],
    ['AKIA0000FAKE', 'AKIA'],
    ['xox0000FAKE', 'xox'],
    ['  ghp_x', 'ghp_'],
    ['\u200bghp_x', 'ghp_'],
    ['\u202esk-x', 'sk-'],
    ['\n\tAKIAx', 'AKIA'],
  ])('refuses %j for %s', (value, prefix) => {
    expect(secretValuePrefix(value)).toBe(prefix);
  });

  it.each(['English', 'Skeleton', 'sk', 'a ghp_x', 'GHP_x', '~/ws/ref', ''])('accepts %j', (value) => {
    expect(secretValuePrefix(value)).toBeUndefined();
  });
});
