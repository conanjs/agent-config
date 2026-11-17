import { describe, expect, it } from 'vitest';
import { composeSources } from '#sources/SourcesModule.ts';
import { createNodeSourceDisk } from '#sources/infrastructure/NodeSourceDisk.ts';
import { createNodeGit } from '#sources/infrastructure/NodeGit.ts';

describe('composeSources', () => {
  it('binds the use cases to the adapters it is given', () => {
    const policy = { allowedProtocols: ['https', 'ssh'] } as const;
    const api = composeSources({
      git: createNodeGit({ policy, environment: {} }),
      disk: createNodeSourceDisk(),
      gitPolicy: policy,
      flavor: 'posix',
    });
    expect(api.acquirePath({ name: 'x', path: '/definitely/not/here' })).toEqual({
      kind: 'missing',
      name: 'x',
      folder: '/definitely/not/here',
    });
    expect(api.isVersionControlled('/definitely/not/here')).toBe(false);
  });
});
