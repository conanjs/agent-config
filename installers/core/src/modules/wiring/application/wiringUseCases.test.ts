// The use cases over small doubles of the ports: planning the compatibility links, deciding the retired paths, reading compat.yaml,
// and the consent check with the lines the needs report prints (needs.feature, security.feature).
import { describe, expect, it } from 'vitest';
import { planCompat } from '#wiring/application/compat/planCompat.ts';
import { planRetired } from '#wiring/application/compat/planRetired.ts';
import { readRetiredList } from '#wiring/application/compat/readRetiredList.ts';
import { renderRetired } from '#wiring/application/compat/renderRetired.ts';
import { describePrivileged } from '#wiring/application/privileged/describePrivileged.ts';
import { checkPrivileged } from '#wiring/application/privileged/privilegedSet.ts';
import type { HookFiles } from '#wiring/application/ports/HookFiles.ts';
import type { PathObserver } from '#wiring/application/ports/PathObserver.ts';
import type { YamlReader } from '#wiring/application/ports/YamlReader.ts';
import { COMPAT_FOLDER_NAMES, COPILOT_FOLDER } from '#wiring/domain/compat/CompatLinks.ts';
import type { Observation } from '#wiring/domain/compat/CompatPlan.ts';

const copilot = (...parts: string[]): string => ['/h', COPILOT_FOLDER, ...parts].join('/');
const observerOf = (table: Record<string, Observation>): PathObserver & { asked: string[] } => {
  const asked: string[] = [];
  return {
    asked,
    observe(target) {
      asked.push(target);
      return table[target] ?? { kind: 'absent' };
    },
  };
};
const hooks = (...texts: string[]): HookFiles => ({ readAll: () => ({ texts, unreadable: false }) });
const json: YamlReader = (text) => ({ ok: true, value: JSON.parse(text) as unknown });
const everything = new Set([...COMPAT_FOLDER_NAMES, 'global-variables.md', 'instructions/core.instructions.md']);
const base = {
  userHome: '/h',
  home: '/h/.agent-config',
  flavor: 'posix',
  homeEntries: everything,
  retired: new Set<string>(),
} as const;

describe('AC-8.1, AC-8.2 planning the compatibility links', () => {
  it('looks at every link path, the own parent folder and Copilot home, and changes nothing', () => {
    const observer = observerOf({ [copilot()]: { kind: 'folder' }, [copilot('instructions')]: { kind: 'folder' } });
    const plan = planCompat(observer, base);
    expect(plan.operations).toHaveLength(10);
    expect(new Set(observer.asked)).toEqual(
      new Set([copilot(), copilot('instructions'), ...plan.operations.map((operation) => operation.path)]),
    );
  });

  it('AC-8.2 creates no own folder and plans no link for hooks or agents when Copilot has only its home', () => {
    const plan = planCompat(observerOf({ [copilot()]: { kind: 'folder' } }), base);
    expect(plan.skipped).toEqual([
      { path: copilot('instructions', 'core.instructions.md'), reason: 'copilot-folder-missing' },
    ]);
    expect(
      [...plan.operations.map((operation) => operation.path), ...plan.skipped.map((entry) => entry.path)].some(
        (entry) => /\/(hooks|agents)\b/.test(entry),
      ),
    ).toBe(false);
  });

  it('asks for Copilot home when nothing of Copilot is installed, because Claude and Codex text still names old paths', () => {
    const plan = planCompat(observerOf({}), base);
    expect(plan.ensureFolders).toEqual([copilot()]);
  });
});

describe('AC-8.3, M-14 deciding the retired paths', () => {
  const patterns = copilot('patterns');
  const own = { kind: 'link', target: '/h/.agent-config/patterns' } as const;
  const request = {
    entries: [{ written: `~/${COPILOT_FOLDER}/patterns`, path: patterns }],
    recorded: [{ path: patterns, target: '/h/.agent-config/patterns' }],
  } as const;

  it('removes the installer own link that no hook names', () => {
    expect(planRetired(observerOf({ [patterns]: own }), hooks('{"hooks":{}}'), request)).toEqual([
      { path: patterns, action: 'remove' },
    ]);
  });

  it('keeps it when a settings file has a hook command that names it (the scenario)', () => {
    const settings = `{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"bash ~/${COPILOT_FOLDER}/patterns/guard.sh"}]}]}}`;
    expect(planRetired(observerOf({ [patterns]: own }), hooks(settings), request)).toEqual([
      { path: patterns, action: 'kept', reason: 'hook-command' },
    ]);
  });

  it('keeps it when a hook file could not be read', () => {
    const unreadable: HookFiles = { readAll: () => ({ texts: [], unreadable: true }) };
    expect(planRetired(observerOf({ [patterns]: own }), unreadable, request)[0]).toMatchObject({
      action: 'kept',
      reason: 'hook-files-unreadable',
    });
  });

  it('leaves a real file and a link to somewhere else, and a path that is gone is gone', () => {
    expect(planRetired(observerOf({ [patterns]: { kind: 'file' } }), hooks(), request)[0]).toMatchObject({
      action: 'left',
    });
    expect(
      planRetired(observerOf({ [patterns]: { kind: 'link', target: '/elsewhere' } }), hooks(), request)[0],
    ).toMatchObject({ action: 'left' });
    expect(planRetired(observerOf({}), hooks(), request)[0]).toMatchObject({ action: 'gone' });
  });

  it('M-03 never removes a path the installer did not record, even when it is a link to the new home', () => {
    expect(planRetired(observerOf({ [patterns]: own }), hooks(), { ...request, recorded: [] })[0]).toMatchObject({
      action: 'left',
    });
  });

  it('reads the hook files once for the whole list', () => {
    let reads = 0;
    const counting: HookFiles = { readAll: () => ((reads += 1), { texts: [], unreadable: false }) };
    planRetired(observerOf({}), counting, {
      ...request,
      entries: [request.entries[0], { written: '~/a', path: '/h/a' }, { written: '~/b', path: '/h/b' }],
    });
    expect(reads).toBe(1);
  });
});

describe('AC-8.3 reading compat.yaml', () => {
  it('reads a file through the YAML reader', () => {
    const text = JSON.stringify({ schema: 'compat-links/v1', retired: [`~/${COPILOT_FOLDER}/patterns`] });
    expect(readRetiredList(text, json, '/h', 'posix')).toEqual({
      ok: true,
      value: [{ written: `~/${COPILOT_FOLDER}/patterns`, path: copilot('patterns') }],
    });
  });

  it('treats a missing file as nothing retired', () => {
    expect(readRetiredList(undefined, json, '/h', 'posix')).toEqual({ ok: true, value: [] });
  });

  it('M-17 reports the findings of the reader with their lines, never the text', () => {
    const refusing: YamlReader = () => ({
      ok: false,
      findings: [
        { code: 'X', message: 'a tag is not allowed', line: 2 },
        { code: 'Y', message: 'too deep', line: undefined },
      ],
    });
    expect(readRetiredList('S3CRET', refusing, '/h', 'posix')).toEqual({
      ok: false,
      error: 'line 2: a tag is not allowed; too deep',
    });
  });

  it('refuses a file with a path that leaves the home', () => {
    expect(
      readRetiredList(JSON.stringify({ schema: 'compat-links/v1', retired: ['~/../etc'] }), json, '/h', 'posix').ok,
    ).toBe(false);
  });
});

describe('M-01 the consent check and what the report prints', () => {
  const guard = {
    id: 'guard',
    event: 'pre-tool',
    agents: ['claude-code'],
    command: 'node {{AGENT_HOME}}/core/tools/guard.mjs',
    matcher: null,
  };
  const request = {
    sources: [{ name: 'sdlc-x', commit: 'live', origin: 'path', hooks: [guard], routes: [], services: [] }],
    approved: [],
    userHome: '/h',
    home: '/h/.agent-config',
    flavor: 'posix',
  } as const;

  it('a new hook is pending and the hash is for the whole set', () => {
    const check = checkPrivileged(request);
    expect(check.ok && check.value.diff.pending.map((item) => [item.entry.key, item.change])).toEqual([
      ['hook:sdlc-x:guard', 'new'],
    ]);
    expect(check.ok && check.value.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the approved set needs nothing again', () => {
    const first = checkPrivileged(request);
    if (!first.ok) throw new Error('check expected');
    const approved = first.value.entries.map((entry) => ({ path: `privileged:${entry.key}`, hash: entry.hash }));
    const second = checkPrivileged({ ...request, approved });
    expect(second.ok && second.value.diff.pending).toEqual([]);
    expect(second.ok && second.value.hash).toBe(first.value.hash);
  });

  it('M-14 a hook command that names the compatibility link of the home is refused', () => {
    const named = { ...guard, command: `bash ~/${COPILOT_FOLDER}/knowledge/guard.sh` };
    const check = checkPrivileged({ ...request, sources: [{ ...request.sources[0], hooks: [named] }] });
    expect(check.ok === false && check.error[0]?.reason).toBe('compat-path');
  });

  const linesOf = (parts: object) => {
    const check = checkPrivileged({
      ...request,
      sources: [{ name: 'c', commit: 'live', origin: 'path', hooks: [], routes: [], services: [], ...parts }],
    });
    if (!check.ok) throw new Error('check expected');
    return describePrivileged(check.value.entries[0]!);
  };

  it('M-01 shows a hook with its command and its matcher, `all tools` when it has none', () => {
    expect(linesOf({ hooks: [guard] })).toEqual({
      item: 'hook guard (claude-code, pre-tool)',
      details: ['   node {{AGENT_HOME}}/core/tools/guard.mjs', '   matcher: all tools'],
    });
    expect(linesOf({ hooks: [{ ...guard, matcher: 'Bash' }] }).details).toEqual([
      '   node {{AGENT_HOME}}/core/tools/guard.mjs',
      '   matcher: Bash',
    ]);
  });

  it('M-01 shows a route with when and read, and before writing when it has one', () => {
    const route = {
      id: 'guide',
      when: 'The project has a .specify folder',
      read: 'frameworks/sdlc-x/index.md',
      beforeWriting: undefined,
    };
    expect(linesOf({ routes: [route] })).toEqual({
      item: 'route guide',
      details: ['   when: The project has a .specify folder; read: frameworks/sdlc-x/index.md'],
    });
    expect(linesOf({ routes: [{ ...route, beforeWriting: 'frameworks/sdlc-x/rules.md' }] }).details).toEqual([
      '   when: The project has a .specify folder; read: frameworks/sdlc-x/index.md',
      '   before writing: frameworks/sdlc-x/rules.md',
    ]);
  });

  it('M-01 shows the arguments of a service as a JSON array, so one argument and two differ', () => {
    const service = (args: string[]) =>
      linesOf({ services: [{ kind: 'mcp', name: 'kb-search', command: 'npx', args }] }).details;
    expect(service(['-y', 'pkg --allow-all'])).toEqual(['   npx ["-y","pkg --allow-all"]']);
    expect(service(['-y', 'pkg', '--allow-all'])).toEqual(['   npx ["-y","pkg","--allow-all"]']);
    expect(service([])).toEqual(['   npx []']);
    expect(
      linesOf({ services: [{ kind: 'mcp', name: 'kb-search', command: 'node', args: ['tools/kb-search.mjs'] }] }).item,
    ).toBe('service kb-search (mcp)');
  });

  it('shows every agent of a hook that names none', () => {
    expect(linesOf({ hooks: [{ ...guard, agents: [] }] }).item).toBe(
      'hook guard (claude-code, copilot-cli, codex, pre-tool)',
    );
  });
});

describe('AC-8.3 the report lines of the retired decisions (compat.feature)', () => {
  const patterns = '/tmp/root/home/.x/patterns';
  it.each([
    ['removed', { path: patterns, action: 'remove' }, `retired: ${patterns}`],
    [
      'not the installer own link',
      { path: patterns, action: 'left', reason: 'not-own' },
      `left: ${patterns}: not the installer's own link`,
    ],
    [
      'used by a hook command',
      { path: patterns, action: 'kept', reason: 'hook-command' },
      `kept: ${patterns}: used by a hook command`,
    ],
    [
      'kept because a hook file cannot be read',
      { path: patterns, action: 'kept', reason: 'hook-files-unreadable' },
      `kept: ${patterns}: used by a hook command`,
    ],
  ] as const)('%s', (_title, decision, line) => {
    expect(renderRetired([decision])).toEqual([line]);
  });

  it('prints nothing for a path that is gone, and one line per path in list order', () => {
    expect(renderRetired([{ path: '/a', action: 'gone' }])).toEqual([]);
    expect(
      renderRetired([
        { path: '/a', action: 'remove' },
        { path: '/b', action: 'gone' },
        { path: '/c', action: 'remove' },
      ]),
    ).toEqual(['retired: /a', 'retired: /c']);
  });

  it('shows a control character of a path as an escape, so a path cannot print a second line', () => {
    expect(renderRetired([{ path: '/a\nretired: /etc', action: 'remove' }])).toEqual(['retired: /a\\x0aretired: /etc']);
  });
});
