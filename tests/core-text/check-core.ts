// The oracle for the core instruction text (specs/022 T095): which lines the core instructions must and must not hold.
// Usage: node tests/core-text/check-core.ts --file <path> [--only var|home|approval]
// Rule groups: var (AC-9.8: the {{VAR}} rule; no line fetches a file; no line tells agents to read link text instead of the target),
// home (AC-6.5: one line defines {{AGENT_HOME}}, no line defines another variable), approval (AC-4.8: one line says agents never run
// add, use or an approval from a needs report without V's approval in chat). Output: one `core: ...` line per finding, then
// `core-text: <n> findings`, exit 1; or `core-text: ok`, exit 0; a usage error exits 2.
import fs from 'node:fs';

const VAR_RULE = '{{VAR}}';
const APPROVAL_RULE = "agents never run add, use or an approval from a NEEDS report without V's approval in chat";
const DEFINITION = /^\s*(?:[-*]\s+)?`?\{\{([A-Z][A-Z0-9_]*)\}\}`?(?:\s+(?:is|means)\b|\s*[=:])/;
const LINK_TEXT = /\blink(?:'s|’s)? text\b|\btext of (?:the|a) link\b/i;

function varFindings(lines: readonly string[]): string[] {
  const rule = lines.filter((line) => line.includes(VAR_RULE));
  const found: string[] = [];
  if (rule.length !== 1) {
    found.push(`core: ${rule.length} lines hold the ${VAR_RULE} rule, expected 1`);
  } else {
    const line = rule[0] ?? '';
    if (!line.includes('global-variables.md')) found.push(`core: the ${VAR_RULE} rule must say to resolve from global-variables.md`);
    if (!/read the resolved file on this machine/i.test(line))
      found.push(`core: the ${VAR_RULE} rule must say to read the resolved file on this machine`);
    if (!/never fetch/i.test(line)) found.push(`core: the ${VAR_RULE} rule must say to never fetch the file`);
  }
  for (const line of lines) {
    if (/\bfetch/i.test(line) && !line.includes(VAR_RULE)) found.push(`core: forbidden line (fetches a file): ${line}`);
    if (LINK_TEXT.test(line)) found.push(`core: forbidden line (reads link text instead of the target): ${line}`);
  }
  return found;
}

function homeFindings(lines: readonly string[]): string[] {
  const defined = lines.flatMap((line) => {
    const name = DEFINITION.exec(line)?.[1];
    return name === undefined ? [] : [{ name, line }];
  });
  const home = defined.filter((d) => d.name === 'AGENT_HOME');
  const found: string[] = [];
  if (home.length === 0) found.push('core: no line defines {{AGENT_HOME}}');
  if (home.length > 1) found.push(`core: {{AGENT_HOME}} is defined by ${home.length} lines, expected 1`);
  for (const d of defined.filter((x) => x.name !== 'AGENT_HOME')) {
    found.push(`core: forbidden line (defines {{${d.name}}}): ${d.line}`);
  }
  return found;
}

function approvalFindings(lines: readonly string[]): string[] {
  const hits = lines.filter(
    (l) => /never run/i.test(l) && l.includes('`add`') && l.includes('`use`') && /needs report/i.test(l) && /approval in chat/i.test(l),
  );
  if (hits.length === 0) return [`core: no line says ${APPROVAL_RULE}`];
  return hits.length === 1 ? [] : [`core: ${hits.length} lines say ${APPROVAL_RULE}, expected 1`];
}

/** The rule groups `--only` accepts. */
export const GROUP_NAMES: readonly string[] = ['var', 'home', 'approval'];

const GROUPS: Readonly<Record<string, (lines: readonly string[]) => string[]>> = {
  var: varFindings,
  home: homeFindings,
  approval: approvalFindings,
};

function main(argv: readonly string[]): number {
  const file = argv[argv.indexOf('--file') + 1];
  const onlyAt = argv.indexOf('--only');
  const only = onlyAt === -1 ? undefined : argv[onlyAt + 1];
  if (!argv.includes('--file') || file === undefined || (only !== undefined && !Object.hasOwn(GROUPS, only))) {
    process.stderr.write('Usage: node tests/core-text/check-core.ts --file <path> [--only var|home|approval]\n');
    return 2;
  }
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const names = only === undefined ? Object.keys(GROUPS) : [only];
  const found = names.flatMap((name) => GROUPS[name]?.(lines) ?? []);
  process.stdout.write(`${[...found, found.length === 0 ? 'core-text: ok' : `core-text: ${found.length} findings`].join('\n')}\n`);
  return found.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
