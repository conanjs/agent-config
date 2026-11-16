import { describe, expect, it } from 'vitest';
import {
  createFaultInjector,
  defaultPortSpecs,
  formatFaults,
  InjectedFault,
  namesComponent,
  parseFaults,
} from '../support/fault-adapters.ts';
import type { Fault, GitPort, LinksPort, PortSpec } from '../support/fault-adapters.ts';

// Fake ports whose real methods record their calls and return fixed values, so a test can tell "the real port ran" from "the fault ran".
interface Fs {
  writeFile(file: string): string;
  rename(from: string, to: string): string;
  readFile(file: string): string;
}
function fileSystem() {
  const calls: string[] = [];
  const port: Fs = {
    writeFile: (file) => (calls.push(`writeFile ${file}`), 'written'),
    rename: (from, to) => (calls.push(`rename ${from} ${to}`), 'renamed'),
    readFile: (file) => (calls.push(`readFile ${file}`), 'contents'),
  };
  const spec: PortSpec<Fs> = { classes: { write: ['writeFile', 'rename'] }, unfaulted: ['readFile'] };
  return { calls, port, spec };
}

function links() {
  const calls: string[] = [];
  const port: LinksPort = {
    createLink: (name, _target, kind) => void calls.push(`createLink ${name} ${kind}`),
    switchLink: (name, _target, kind) => void calls.push(`switchLink ${name} ${kind}`),
    removeLink: (name) => void calls.push(`removeLink ${name}`),
    readLink: (name) => (calls.push(`readLink ${name}`), 'target'),
  };
  return { calls, port };
}

function git() {
  const calls: string[] = [];
  const port: GitPort = {
    clone: (r) => (calls.push(`clone ${r.component}`), Promise.resolve()),
    fetch: (r) => (calls.push(`fetch ${r.component}`), Promise.resolve()),
    revParse: () => Promise.resolve('abc'),
    checkout: () => Promise.resolve(),
  };
  return { calls, port };
}

const request = (component: string, url = `/s/${component}.git`) => ({ component, url, dest: `/d/${component}` });

function killer() {
  const killed: string[] = [];
  return { killed, kill: () => void killed.push('killed') };
}

describe('T118 fault grammar', () => {
  it('T118: parses every fault and formats it back', () => {
    const text =
      'fail-write:3,fail-write-at:install-state.json,links-denied,links-denied:symlink,links-denied:junction,fetch-fails:core,' +
      'kill-at:before-first-switch,kill-at:after-switch:2,kill-at:mid-switch:1,kill-at:before-commit';
    const faults = parseFaults(text);
    expect(faults).toHaveLength(10);
    expect(faults[0]).toEqual<Fault>({ kind: 'fail-nth-write', n: 3 });
    expect(faults[4]).toEqual<Fault>({ kind: 'links-not-permitted', linkKind: 'junction' });
    expect(formatFaults(faults)).toBe(text);
  });

  it('T118: kill-after-switch is an alias of kill-at:after-switch', () => {
    expect(parseFaults('kill-after-switch:2')).toEqual(parseFaults('kill-at:after-switch:2'));
  });

  it('T118: empty text is no fault', () => {
    expect(parseFaults('')).toEqual([]);
    expect(parseFaults(' , ')).toEqual([]);
  });

  it.each([
    'succeed-always',
    'fail-write',
    'fail-write:0',
    'fail-write:x',
    'fail-write:1:2:3',
    'fail-write-at',
    'fail-write-at:a:b',
    'links-denied:hardlink',
    'links-denied:symlink:x',
    'fetch-fails:../x',
    'fetch-fails:',
    'kill-after-switch:-1',
    'kill-at',
    'kill-at:nowhere',
    'kill-at:after-switch',
    'kill-at:mid-switch:0',
    'kill-at:before-commit:1',
    'kill-at:before-first-switch:2',
  ])('T118: refuses the malformed fault %s', (text) => {
    expect(() => parseFaults(text)).toThrow();
  });
});

describe('T118 fail the nth write and fail a write by path', () => {
  it('T118: fails exactly write 2, without calling the real port, and lets writes 1 and 3 through', () => {
    const fs = fileSystem();
    const wrapped = createFaultInjector([{ kind: 'fail-nth-write', n: 2 }]).wrap('fileSystem', fs.port, fs.spec);
    expect(wrapped.writeFile('a')).toBe('written');
    expect(() => wrapped.rename('b', 'c')).toThrow(InjectedFault);
    expect(wrapped.writeFile('c')).toBe('written');
    expect(fs.calls).toEqual(['writeFile a', 'writeFile c']);
  });

  it('T118: the injected error says what failed', () => {
    const fs = fileSystem();
    const wrapped = createFaultInjector([{ kind: 'fail-nth-write', n: 1 }]).wrap('fileSystem', fs.port, fs.spec);
    expect(() => wrapped.writeFile('a')).toThrowError(
      expect.objectContaining({ injected: true, code: 'EIO', fault: 'fail-nth-write' }),
    );
  });

  it('T118: reads are never counted or failed', () => {
    const fs = fileSystem();
    const injector = createFaultInjector([{ kind: 'fail-nth-write', n: 1 }]);
    const wrapped = injector.wrap('fileSystem', fs.port, fs.spec);
    expect(wrapped.readFile('x')).toBe('contents');
    expect(injector.report().writes).toBe(0);
  });

  it('T118: a write number the run never reaches changes nothing', () => {
    const fs = fileSystem();
    const wrapped = createFaultInjector([{ kind: 'fail-nth-write', n: 9 }]).wrap('fileSystem', fs.port, fs.spec);
    expect([wrapped.writeFile('a'), wrapped.rename('b', 'c')]).toEqual(['written', 'renamed']);
  });

  it('T118: an error of the real port still fails when no fault applies (a failure is never turned into a success)', () => {
    const real = {
      writeFile: (): string => {
        throw new Error('disk full');
      },
      readFile: () => 'x',
    };
    const spec: PortSpec<typeof real> = { classes: { write: ['writeFile'] }, unfaulted: ['readFile'] };
    expect(() => createFaultInjector([]).wrap('fileSystem', real, spec).writeFile()).toThrow('disk full');
    expect(() => createFaultInjector([{ kind: 'fail-nth-write', n: 5 }]).wrap('fileSystem', real, spec).writeFile()).toThrow(
      'disk full',
    );
  });

  it('T118: fail-write-at fails every write that has an argument ending with the suffix, and no other', () => {
    const fs = fileSystem();
    const wrapped = createFaultInjector([{ kind: 'fail-write-at', suffix: 'install-state.json' }]).wrap('fileSystem', fs.port, fs.spec);
    expect(wrapped.writeFile('/h/install-state.pending.json')).toBe('written');
    expect(() => wrapped.rename('/h/x.tmp', '/h/install-state.json')).toThrowError(expect.objectContaining({ code: 'EIO', fault: 'fail-write-at' }));
    expect(() => wrapped.writeFile('/h/install-state.json')).toThrow(InjectedFault);
    expect(wrapped.readFile('/h/install-state.json')).toBe('contents');
    expect(fs.calls).toEqual(['writeFile /h/install-state.pending.json', 'readFile /h/install-state.json']);
  });

  it('T118: the report counts the writes and lists the failure', () => {
    const fs = fileSystem();
    const injector = createFaultInjector([{ kind: 'fail-nth-write', n: 2 }]);
    const wrapped = injector.wrap('fileSystem', fs.port, fs.spec);
    wrapped.writeFile('a');
    expect(() => wrapped.rename('b', 'c')).toThrow();
    expect(injector.report()).toEqual({ writes: 2, linkSwitches: 0, injected: ['fail-nth-write: EIO: i/o error, write 2 (injected fault)'] });
  });
});

describe('T118 links not permitted', () => {
  it('T118: every link creation throws EPERM and reads and removals still work', () => {
    const l = links();
    const wrapped = createFaultInjector([{ kind: 'links-not-permitted' }]).wrap('links', l.port);
    expect(() => wrapped.createLink('a', 't', 'symlink')).toThrowError(expect.objectContaining({ code: 'EPERM' }));
    expect(() => wrapped.switchLink('a', 't', 'junction')).toThrowError(expect.objectContaining({ code: 'EPERM' }));
    expect(wrapped.readLink('a')).toBe('target');
    wrapped.removeLink('a');
    expect(l.calls).toEqual(['readLink a', 'removeLink a']);
  });

  it('T118: links-denied:symlink refuses symlinks only, links-denied:junction junctions only', () => {
    const l = links();
    const symlinks = createFaultInjector([{ kind: 'links-not-permitted', linkKind: 'symlink' }]).wrap('links', l.port);
    expect(() => symlinks.createLink('a', 't', 'symlink')).toThrow(InjectedFault);
    expect(() => symlinks.createLink('b', 't', 'junction')).not.toThrow();
    const junctions = createFaultInjector([{ kind: 'links-not-permitted', linkKind: 'junction' }]).wrap('links', l.port);
    expect(() => junctions.switchLink('c', 't', 'junction')).toThrow(InjectedFault);
    expect(() => junctions.switchLink('d', 't', 'symlink')).not.toThrow();
    expect(l.calls).toEqual(['createLink b junction', 'switchLink d symlink']);
  });

  it('T118: without the fault a link is created', () => {
    const l = links();
    createFaultInjector([]).wrap('links', l.port).createLink('a', 't', 'symlink');
    expect(l.calls).toEqual(['createLink a symlink']);
  });
});

describe('T118 fetch fails for component X', () => {
  it('T118: a clone naming the component rejects, one naming another goes through', async () => {
    const g = git();
    const wrapped = createFaultInjector([{ kind: 'fetch-fails', component: 'core' }]).wrap('git', g.port);
    await expect(wrapped.clone(request('core'))).rejects.toBeInstanceOf(InjectedFault);
    await expect(wrapped.fetch(request('core', 'https://example.invalid/o/core.git'))).rejects.toBeInstanceOf(InjectedFault);
    await expect(wrapped.clone(request('agentic-sdlc'))).resolves.toBeUndefined();
    expect(g.calls).toEqual(['clone agentic-sdlc']);
  });

  it('T118: the component field decides before the url does', async () => {
    const g = git();
    const wrapped = createFaultInjector([{ kind: 'fetch-fails', component: 'core' }]).wrap('git', g.port);
    await expect(wrapped.clone(request('agentic-sdlc', '/s/core.git'))).resolves.toBeUndefined();
    await expect(wrapped.clone(request('core', '/s/other.git'))).rejects.toBeInstanceOf(InjectedFault);
  });

  it('T118: operations that do not fetch are never faulted', async () => {
    const wrapped = createFaultInjector([{ kind: 'fetch-fails', component: 'core' }]).wrap('git', git().port);
    await expect(wrapped.revParse('/d/core')).resolves.toBe('abc');
  });

  it('T118: a faulted async method rejects instead of throwing', async () => {
    const wrapped = createFaultInjector([{ kind: 'fetch-fails', component: 'core' }]).wrap('git', git().port);
    const pending = wrapped.clone(request('core'));
    expect(pending).toBeInstanceOf(Promise);
    await expect(pending).rejects.toBeInstanceOf(InjectedFault);
  });

  it('T118: without a component field the match is exact on the last path segment, never a substring', () => {
    expect(namesComponent(['/s/core.git'], 'core')).toBe(true);
    expect(namesComponent(['/s/store/core@1a2b3c'], 'core')).toBe(true);
    expect(namesComponent([{ component: 'core' }], 'core')).toBe(true);
    expect(namesComponent(['/s/core-extra.git', '/core/other.git', '--'], 'core')).toBe(false);
  });
});

describe('T118 process killed at a point of a run', () => {
  it('T118: before-first-switch kills as the first atomic switch starts, and the switch does not run', () => {
    const l = links();
    const k = killer();
    const wrapped = createFaultInjector([{ kind: 'kill', point: 'before-first-switch' }], { kill: k.kill }).wrap('links', l.port);
    wrapped.createLink('a', 't', 'symlink');
    expect(() => wrapped.switchLink('a', 't', 'symlink')).toThrowError(expect.objectContaining({ code: 'KILLED' }));
    expect(k.killed).toHaveLength(1);
    expect(l.calls).toEqual(['createLink a symlink']);
  });

  it('T118: after-switch:1 kills once switch 1 completed, so the switch ran and its caller never sees a return', () => {
    const l = links();
    const k = killer();
    const injector = createFaultInjector([{ kind: 'kill', point: 'after-switch', n: 1 }], { kill: k.kill });
    const wrapped = injector.wrap('links', l.port);
    expect(() => wrapped.switchLink('a', 't', 'symlink')).toThrowError(expect.objectContaining({ code: 'KILLED' }));
    expect(k.killed).toHaveLength(1);
    expect(l.calls).toEqual(['switchLink a symlink']);
    expect(injector.report().linkSwitches).toBe(1);
  });

  it('T118: after-switch:k can equal the number of switches: the kill falls after the last one', () => {
    const l = links();
    const k = killer();
    const wrapped = createFaultInjector([{ kind: 'kill', point: 'after-switch', n: 2 }], { kill: k.kill }).wrap('links', l.port);
    wrapped.switchLink('a', 't', 'symlink');
    expect(k.killed).toEqual([]);
    expect(() => wrapped.switchLink('b', 't', 'symlink')).toThrow(InjectedFault);
    expect(l.calls).toEqual(['switchLink a symlink', 'switchLink b symlink']);
  });

  it('T118: a kill planned after more switches than the run makes never fires', () => {
    const l = links();
    const k = killer();
    const wrapped = createFaultInjector([{ kind: 'kill', point: 'after-switch', n: 3 }], { kill: k.kill }).wrap('links', l.port);
    wrapped.switchLink('a', 't', 'symlink');
    wrapped.switchLink('b', 't', 'symlink');
    expect(k.killed).toEqual([]);
  });

  it('T118: a composed switch (removeLink then createLink) counts as one switch, and mid-switch:1 kills between the two', () => {
    const l = links();
    const k = killer();
    const wrapped = createFaultInjector([{ kind: 'kill', point: 'mid-switch', n: 1 }], { kill: k.kill }).wrap('links', l.port);
    wrapped.removeLink('a');
    expect(() => wrapped.createLink('a', 't', 'junction')).toThrowError(expect.objectContaining({ code: 'KILLED' }));
    expect(l.calls).toEqual(['removeLink a']);
  });

  it('T118: after-switch counts a composed switch when its createLink returns', () => {
    const l = links();
    const k = killer();
    const wrapped = createFaultInjector([{ kind: 'kill', point: 'after-switch', n: 1 }], { kill: k.kill }).wrap('links', l.port);
    wrapped.removeLink('a');
    expect(k.killed).toEqual([]);
    expect(() => wrapped.createLink('a', 't', 'junction')).toThrow(InjectedFault);
    expect(l.calls).toEqual(['removeLink a', 'createLink a junction']);
  });

  it('T118: mid-switch never fires for an atomic switch, and a plain creation is not a switch', () => {
    const l = links();
    const k = killer();
    const wrapped = createFaultInjector(
      [
        { kind: 'kill', point: 'mid-switch', n: 1 },
        { kind: 'kill', point: 'after-switch', n: 1 },
      ],
      { kill: k.kill },
    ).wrap('links', l.port);
    wrapped.createLink('a', 't', 'symlink');
    expect(k.killed).toEqual([]);
  });

  it('T118: before-commit kills as the write of install-state.json starts, not an earlier or other write', () => {
    const fs = fileSystem();
    const k = killer();
    const wrapped = createFaultInjector([{ kind: 'kill', point: 'before-commit' }], { kill: k.kill }).wrap('fileSystem', fs.port, fs.spec);
    wrapped.writeFile('/h/install-state.pending.json');
    wrapped.writeFile('/h/install-state.json.tmp');
    expect(k.killed).toEqual([]);
    expect(() => wrapped.rename('/h/install-state.json.tmp', '/h/install-state.json')).toThrowError(expect.objectContaining({ code: 'KILLED' }));
    expect(k.killed).toHaveLength(1);
    expect(fs.calls).toEqual(['writeFile /h/install-state.pending.json', 'writeFile /h/install-state.json.tmp']);
  });
});

describe('T118 the wrapper is strict about the port it wraps', () => {
  it('T118: a port method the spec does not classify fails the build of the test composition', () => {
    const fs = fileSystem();
    const port = { ...fs.port, truncate: () => 0 };
    expect(() => createFaultInjector([]).wrap('fileSystem', port, fs.spec as unknown as PortSpec<typeof port>)).toThrow(/truncate/);
  });

  it('T118: a spec method the port does not have fails the build of the test composition', () => {
    const fs = fileSystem();
    const spec = { classes: { write: ['writeFile', 'rename', 'chmod'] }, unfaulted: ['readFile'] } as unknown as PortSpec<Fs>;
    expect(() => createFaultInjector([]).wrap('fileSystem', fs.port, spec)).toThrow(/chmod/);
  });

  it('T118: methods of a class instance, including inherited ones, are wrapped and keep their own this', () => {
    class Base {
      protected tag = 'base';
      readFile(): string {
        return this.tag;
      }
    }
    class Real extends Base {
      writeFile(): string {
        return `wrote with ${this.tag}`;
      }
    }
    const spec: PortSpec<Real> = { classes: { write: ['writeFile'] }, unfaulted: ['readFile'] };
    const wrapped = createFaultInjector([{ kind: 'fail-nth-write', n: 2 }]).wrap('fileSystem', new Real(), spec);
    expect(wrapped.readFile()).toBe('base');
    expect(wrapped.writeFile()).toBe('wrote with base');
    expect(() => wrapped.writeFile()).toThrow(InjectedFault);
  });

  it('T118: the default specs keep a switch inside the creating methods, and the Git port is the only async one', () => {
    expect(defaultPortSpecs.links.classes['switch']?.every((m) => defaultPortSpecs.links.classes['create']?.includes(m))).toBe(true);
    expect(defaultPortSpecs.git.async).toBe(true);
    expect(defaultPortSpecs.fileSystem.async).toBeUndefined();
    expect(defaultPortSpecs.links.async).toBeUndefined();
  });
});
