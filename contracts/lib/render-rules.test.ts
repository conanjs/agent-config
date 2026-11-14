// Tests of the render rules (specs/022 T057): the swap rule table of decisions/qa.md 5.1, the generated-from line, idempotence,
// the character counter and the relative target. The platform is an argument, so the Windows rows run on every system.
// Test titles start with the id they prove: AC-1.7, AC-16.2 to AC-16.4 (spec.md), A-20 to A-22, A-28, RC-4, RC-5 (rendered-copy-v1.md).
import { describe, expect, it } from 'vitest';
import {
  addGeneratedFromLine,
  countCharacters,
  generatedFromLine,
  relativeTarget,
  renderText,
  swapAgentHome,
  type Platform,
  type SwapContext,
} from './render-rules.ts';

const mac: SwapContext = { home: '/Users/v/.agent-config', platform: 'darwin', allowList: [] };
const windows: SwapContext = { home: String.raw`C:\Users\v\.agent-config`, platform: 'win32', allowList: [] };

function on(platform: Platform, home: string, allowList: readonly string[] = []): SwapContext {
  return { home, platform, allowList };
}

describe('AC-1.7 swap rules (qa.md 5.1), one row for each case of the table', () => {
  it.each([
    [
      'Mac: the placeholder becomes the real path',
      mac,
      'Read {{AGENT_HOME}}/knowledge/x.md first.',
      'Read /Users/v/.agent-config/knowledge/x.md first.',
    ],
    [
      'Linux uses / too',
      on('linux', '/home/v/.agent-config'),
      'Read {{AGENT_HOME}}/knowledge/x.md first.',
      'Read /home/v/.agent-config/knowledge/x.md first.',
    ],
    [
      'Windows: the path keeps the system separators',
      windows,
      'Read {{AGENT_HOME}}/knowledge/x.md first.',
      String.raw`Read C:\Users\v\.agent-config\knowledge\x.md first.`,
    ],
    [
      'spaces: link text shows the real path, the relative target stays',
      on('darwin', '/Users/Vinh Do/.agent-config'),
      'See [{{AGENT_HOME}}/knowledge/x.md](../../knowledge/x.md).',
      'See [/Users/Vinh Do/.agent-config/knowledge/x.md](../../knowledge/x.md).',
    ],
    [
      'non-ASCII: the user name survives',
      on('darwin', '/Users/Vinh Đỗ/.agent-config'),
      'Read {{AGENT_HOME}}/knowledge/x.md first.',
      'Read /Users/Vinh Đỗ/.agent-config/knowledge/x.md first.',
    ],
    [
      'the old agent home ~/.copilot is swapped',
      mac,
      'Read ~/.copilot/knowledge/x.md first.',
      'Read /Users/v/.agent-config/knowledge/x.md first.',
    ],
    [
      'the old agent home on Windows takes the system separators',
      windows,
      'Read ~/.copilot/knowledge/x.md first.',
      String.raw`Read C:\Users\v\.agent-config\knowledge\x.md first.`,
    ],
    ['the home alone, with no path', mac, 'The home is {{AGENT_HOME}}.', 'The home is /Users/v/.agent-config.'],
    ['~/.copilot alone, with no path', mac, 'Under ~/.copilot, read it.', 'Under /Users/v/.agent-config, read it.'],
    [
      'a trailing separator on the home is not doubled',
      on('darwin', '/Users/v/.agent-config/'),
      '{{AGENT_HOME}}/a.md',
      '/Users/v/.agent-config/a.md',
    ],
    [
      'a Windows home with a trailing separator',
      on('win32', 'C:\\Users\\v\\.agent-config\\'),
      '{{AGENT_HOME}}/a.md',
      String.raw`C:\Users\v\.agent-config\a.md`,
    ],
    [
      'two paths on one line are both swapped',
      mac,
      '`{{AGENT_HOME}}/a.md` and ~/.copilot/b.md',
      '`/Users/v/.agent-config/a.md` and /Users/v/.agent-config/b.md',
    ],
    [
      'a path in a code block is swapped too (RC-5)',
      mac,
      '```\ncat {{AGENT_HOME}}/a.md\n```',
      '```\ncat /Users/v/.agent-config/a.md\n```',
    ],
    [
      'a path ends at a closing bracket or quote',
      mac,
      '("{{AGENT_HOME}}/a.md") [{{AGENT_HOME}}/b.md]',
      '("/Users/v/.agent-config/a.md") [/Users/v/.agent-config/b.md]',
    ],
    [
      'a folder that only starts like the old home is left alone',
      mac,
      'See ~/.copilot-extra/a.md and ~/.copilotx.',
      'See ~/.copilot-extra/a.md and ~/.copilotx.',
    ],
    [
      'another placeholder is left alone',
      mac,
      'Use {{LANGUAGE}} and {{AGENT_CONFIG_REPO}}/a.md.',
      'Use {{LANGUAGE}} and {{AGENT_CONFIG_REPO}}/a.md.',
    ],
    [
      'a home with $ and \\ characters is inserted as written',
      on('darwin', '/Users/a$&b/$1'),
      '{{AGENT_HOME}}/x.md',
      '/Users/a$&b/$1/x.md',
    ],
    ['a Windows line ending is kept', mac, 'a {{AGENT_HOME}}/x.md\r\nb\r\n', 'a /Users/v/.agent-config/x.md\r\nb\r\n'],
    ['an empty text stays empty', mac, '', ''],
  ])('%s', (_label, context, source, expected) => {
    expect(swapAgentHome(source, context)).toBe(expected);
  });

  it('an empty home is refused, since every path would land at the root folder', () => {
    expect(() => swapAgentHome('{{AGENT_HOME}}/a.md', on('darwin', ''))).toThrow(RangeError);
    expect(() => swapAgentHome('{{AGENT_HOME}}/a.md', on('darwin', '/'))).toThrow(RangeError);
  });
});

describe('A-21 the allow-list keeps whole lines as written', () => {
  const definition = 'The home is {{AGENT_HOME}}.';
  const copilotOwn = 'Copilot reads ~/.copilot/instructions/core.instructions.md itself.';

  it('a listed line keeps its placeholder, and the same text on a line not listed is swapped', () => {
    const context = on('darwin', '/Users/v/.agent-config', [definition]);
    expect(swapAgentHome(`${definition}\nRead {{AGENT_HOME}}/knowledge/x.md first.`, context)).toBe(
      `${definition}\nRead /Users/v/.agent-config/knowledge/x.md first.`,
    );
    expect(swapAgentHome(`Note: ${definition}`, context)).toBe('Note: The home is /Users/v/.agent-config.');
  });

  it("Copilot's own path stays as written when its line is listed, and is swapped when it is not", () => {
    expect(swapAgentHome(copilotOwn, on('darwin', '/Users/v/.agent-config', [copilotOwn]))).toBe(copilotOwn);
    expect(swapAgentHome(copilotOwn, mac)).toBe(
      'Copilot reads /Users/v/.agent-config/instructions/core.instructions.md itself.',
    );
  });

  it('a listed line is found whatever its line ending, and the ending is kept', () => {
    const context = on('darwin', '/Users/v/.agent-config', [definition]);
    expect(swapAgentHome(`${definition}\r\nx\r\n`, context)).toBe(`${definition}\r\nx\r\n`);
  });

  it('an empty row in the list does not keep every empty line forever or break anything', () => {
    expect(swapAgentHome('\n{{AGENT_HOME}}/a\n', on('darwin', '/h', ['']))).toBe('\n/h/a\n');
  });
});

describe('AC-16.4 the generated-from line (A-22)', () => {
  const line = 'Generated from `copilot/instructions/x.md`; edit that file, not this copy.';

  it('has the text of the contract', () => {
    expect(generatedFromLine('copilot/instructions/x.md')).toBe(line);
  });

  it('a path with a backtick or a line break cannot end the code span early', () => {
    expect(generatedFromLine('a`b\nc')).toBe('Generated from `a%60b%0Ac`; edit that file, not this copy.');
  });

  it.each([
    ['no front matter: the first line', 'First line of the source.', `${line}\nFirst line of the source.`],
    [
      'front matter: right after its closing line',
      '---\napplyTo: "**"\n---\nFirst line of the source.',
      `---\napplyTo: "**"\n---\n${line}\nFirst line of the source.`,
    ],
    ['front matter and nothing after it', '---\na: 1\n---', `---\na: 1\n---\n${line}\n`],
    ['front matter never closed: the first line', '---\na: 1\nBody', `${line}\n---\na: 1\nBody`],
    ['a --- later in the text is not front matter', 'Body\n---\nmore', `${line}\nBody\n---\nmore`],
    ['an empty text', '', `${line}\n`],
    [
      'Windows line endings: the line takes them',
      '---\r\na: 1\r\n---\r\nBody\r\n',
      `---\r\na: 1\r\n---\r\n${line}\r\nBody\r\n`,
    ],
  ])('%s', (_label, source, expected) => {
    expect(addGeneratedFromLine(source, 'copilot/instructions/x.md')).toBe(expected);
  });

  it.each([['First line.'], ['---\na: 1\n---\nBody'], ['']])('adding it twice adds it once (RC-4): %j', (source) => {
    const once = addGeneratedFromLine(source, 'a/b.md');
    expect(addGeneratedFromLine(once, 'a/b.md')).toBe(once);
    expect(once.split('Generated from')).toHaveLength(2);
  });
});

describe('RC-4 only the exact generated-from line counts as already there', () => {
  it.each([
    ['an ordinary first line that starts with the same words', 'Generated from the team notes.'],
    ['the same words with another ending', 'Generated from `a.md`; edit it.'],
    ['an empty path', 'Generated from ``; edit that file, not this copy.'],
    ['text after the line on the same line', 'Generated from `a.md`; edit that file, not this copy. More'],
  ])('%s gets the line added above it', (_label, first) => {
    const out = addGeneratedFromLine(first, 'a/b.md');
    expect(out).toBe(`Generated from \`a/b.md\`; edit that file, not this copy.\n${first}`);
  });
});

describe('A-22 a byte order mark before the front matter', () => {
  const line = 'Generated from `x.md`; edit that file, not this copy.';
  it.each([
    ['front matter after a BOM is front matter', '\uFEFF---\na: 1\n---\nBody', `\uFEFF---\na: 1\n---\n${line}\nBody`],
    ['a BOM and no front matter: the line follows the BOM', '\uFEFFBody', `\uFEFF${line}\nBody`],
    ['a BOM alone', '\uFEFF', `\uFEFF${line}\n`],
    ['a BOM and front matter with nothing after', '\uFEFF---\na: 1\n---', `\uFEFF---\na: 1\n---\n${line}\n`],
  ])('%s', (_label, source, expected) => {
    expect(addGeneratedFromLine(source, 'x.md')).toBe(expected);
    expect(addGeneratedFromLine(expected, 'x.md')).toBe(expected);
  });
});

describe('A-20 link targets are not swapped into absolute paths', () => {
  it.each([
    ['an inline target', '[a]({{AGENT_HOME}}/x.md)', '[a]({{AGENT_HOME}}/x.md)'],
    [
      'link text swapped, target left',
      '[{{AGENT_HOME}}/x.md]({{AGENT_HOME}}/x.md)',
      '[/Users/v/.agent-config/x.md]({{AGENT_HOME}}/x.md)',
    ],
    ['a reference-style target', '[a]: {{AGENT_HOME}}/x.md', '[a]: {{AGENT_HOME}}/x.md'],
    ['an old-home inline target', '[a](~/.copilot/x.md)', '[a](~/.copilot/x.md)'],
    [
      'a prose mention next to a link',
      'See {{AGENT_HOME}}/y.md and [a](z.md).',
      'See /Users/v/.agent-config/y.md and [a](z.md).',
    ],
  ])('%s', (_label, source, expected) => {
    expect(swapAgentHome(source, mac)).toBe(expected);
  });
});

describe('A-28 rendering the dry run and the renderer share', () => {
  const source =
    '---\napplyTo: "**"\n---\nRead {{AGENT_HOME}}/knowledge/x.md and ~/.copilot/a.md.\nThe home is {{AGENT_HOME}}.\n';
  const context = on('darwin', '/Users/Vinh Đỗ/.agent-config', ['The home is {{AGENT_HOME}}.']);

  it('swaps the paths, keeps the listed line and puts the line after the front matter', () => {
    expect(renderText(source, context, 'copilot/instructions/x.md')).toBe(
      [
        '---',
        'applyTo: "**"',
        '---',
        'Generated from `copilot/instructions/x.md`; edit that file, not this copy.',
        'Read /Users/Vinh Đỗ/.agent-config/knowledge/x.md and /Users/Vinh Đỗ/.agent-config/a.md.',
        'The home is {{AGENT_HOME}}.',
        '',
      ].join('\n'),
    );
  });

  it('RC-4 the same input gives byte-identical output, and rendering the output again changes nothing', () => {
    const first = renderText(source, context, 'copilot/instructions/x.md');
    expect(renderText(source, context, 'copilot/instructions/x.md')).toBe(first);
    expect(renderText(first, context, 'copilot/instructions/x.md')).toBe(first);
  });

  it('RC-5 no {{AGENT_HOME}} path is left except on the allow-list', () => {
    const rendered = renderText(source, context, 'copilot/instructions/x.md');
    const left = rendered.split('\n').filter((line) => /\{\{AGENT_HOME\}\}/.test(line));
    expect(left).toEqual(['The home is {{AGENT_HOME}}.']);
  });

  it('the same source renders differently only in the home, on Mac and on Windows', () => {
    const onMac = renderText('a {{AGENT_HOME}}/b/c.md', mac, 's.md');
    const onWindows = renderText('a {{AGENT_HOME}}/b/c.md', windows, 's.md');
    expect(onMac.split('\n')[1]).toBe('a /Users/v/.agent-config/b/c.md');
    expect(onWindows.split('\n')[1]).toBe(String.raw`a C:\Users\v\.agent-config\b\c.md`);
    expect(onMac.split('\n')[0]).toBe(onWindows.split('\n')[0]);
  });

  it('does not change the allow-list or the context it was given', () => {
    const list = ['The home is {{AGENT_HOME}}.'];
    const given: SwapContext = { home: '/h', platform: 'darwin', allowList: list };
    const before = JSON.stringify(given);
    renderText(source, given, 'a.md');
    expect(JSON.stringify(given)).toBe(before);
  });
});

describe('AC-1.7 the character counter counts Unicode code points (DR-106, A-7)', () => {
  it.each([
    ['nothing', '', 0],
    ['ASCII', 'abc', 3],
    ['a letter with an accent as one code point', '\u00e9', 1],
    ['the same letter as two code points', 'e\u0301', 2],
    ['an emoji outside the Basic Multilingual Plane, which .length counts as 2', '\u{1F600}', 1],
    ['Vietnamese letters', 'Vinh Đỗ', 7],
    ['a Windows line ending', 'a\r\nb', 4],
    ['a lone surrogate', '\ud83d', 1],
  ])('%s', (_label, text, expected) => {
    expect(countCharacters(text)).toBe(expected);
  });

  it('the swap makes a text longer or shorter by the difference of the paths, in code points', () => {
    const source = 'Read {{AGENT_HOME}}/a.md';
    const rendered = swapAgentHome(source, on('darwin', '/Users/Vinh Đỗ/.agent-config'));
    expect(countCharacters(rendered) - countCharacters(source)).toBe(
      countCharacters('/Users/Vinh Đỗ/.agent-config') - '{{AGENT_HOME}}'.length,
    );
  });
});

describe('AC-16.2 and A-20 the relative target of a rendered citation', () => {
  it.each([
    ['a copy one folder down', 'generated/agentic-sdlc/foo.md', 'knowledge/x.md', '../../knowledge/x.md'],
    ['a copy in a deeper folder', 'generated/agentic-sdlc/a/b/foo.md', 'knowledge/x.md', '../../../../knowledge/x.md'],
    ['the cited file in the same tree', 'generated/core/a/foo.md', 'generated/core/a/bar.md', 'bar.md'],
    [
      'a cited folder with a space has it encoded',
      'generated/c/foo.md',
      'knowledge/my notes/x.md',
      '../../knowledge/my%20notes/x.md',
    ],
    ["the copy's own folder is a dot, not an empty path", 'generated/c/foo.md', 'generated/c', '.'],
    [
      'a percent sign is encoded first and only once',
      'generated/c/foo.md',
      'knowledge/100% a.md',
      '../../knowledge/100%25%20a.md',
    ],
    ['a hash is encoded', 'generated/c/foo.md', 'knowledge/a#b.md', '../../knowledge/a%23b.md'],
    ['parentheses are encoded', 'generated/c/foo.md', 'knowledge/a (1).md', '../../knowledge/a%20%281%29.md'],
    ['a cited non-ASCII name is kept', 'generated/c/foo.md', 'knowledge/Đỗ.md', '../../knowledge/Đỗ.md'],
  ])('%s', (_label, copyFile, cited, expected) => {
    expect(relativeTarget(copyFile, cited)).toBe(expected);
  });

  it('is the same on Mac and Windows: the home never enters the target', () => {
    expect(relativeTarget('generated/agentic-sdlc/foo.md', 'knowledge/x.md')).toBe('../../knowledge/x.md');
  });
});
