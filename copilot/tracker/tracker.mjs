#!/usr/bin/env node
// tracker.mjs — checks, briefs and edits a repo's TRACKER.md: the open work agents and people carry from one session
// to the next (tracker/v1, schema: tracker.schema.md beside this file).
//
// Usage: node tracker.mjs [file or folder] [mode]
//   (no mode)          check TR-1 … TR-10
//   --brief            the open items, most urgent first; nothing when there are none
//   --hook claude      the brief as SessionStart JSON (systemMessage for the user, additionalContext for the model);
//                      --hook codex: the same JSON, which Codex reads too; --hook copilot: Copilot CLI's (additionalContext)
//   --stdin            take the folder from the hook payload's `cwd` on stdin
//   --add <title> --next <step> [--status open|doing|waiting] [--waiting-on <who>] [--priority high|normal|low]
//         [--due <date>] [--done-when <check>] [--from <context>] [--note <text>] [--links <text>]
//   --update T-<n> [the same fields]   --close T-<n> [--note <text>]   --drop T-<n> --why <text>
// The folder defaults to the current one; inside a git repo the tracker is TRACKER.md at the repo's top level.
// A TRACKER.md created by --add is listed in .git/info/exclude (local until `git add -f`). Edits that would break a
// rule are refused. "Today" is TRACKER_TODAY when set (tests), else the local date.
// No dependencies: it runs installed under ~/.copilot as well as in the repo.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const NAME = 'TRACKER.md';
const TOOL = '~/.copilot/tracker/tracker.mjs';
const KEYS = ['status', 'priority', 'next', 'waiting-on', 'due', 'done-when', 'from', 'updated', 'closed', 'why', 'note', 'links'];
const NEEDS = { open: ['next', 'from'], doing: ['next', 'from'], waiting: ['next', 'waiting-on', 'from'], done: ['from', 'closed'], dropped: ['from', 'closed', 'why'] };
const SECTION_OF = { open: 'Open', doing: 'Open', waiting: 'Open', done: 'Done', dropped: 'Done' };
const PRIORITIES = ['high', 'normal', 'low'];
const DATED = ['from', 'updated', 'closed', 'due'];
const STALE_DAYS = 14;
const PREAMBLE = '# Tracker\n\nWork this repo still owes, carried from one session to the next. Format and tool: tracker/v1 (agent-config, copilot/tracker/).';
const GUIDE = `These are the open items in this repo's ${NAME} (tracker/v1). Tell the user about any item that looks done, and close it once they agree: node ${TOOL} --close <id>. When this session leaves work undone, add it with --add; when it finishes an item, close it.`;

// ---- arguments ------------------------------------------------------------------------------------------
const VALUED = ['add', 'next', 'status', 'waiting-on', 'priority', 'due', 'done-when', 'from', 'note', 'links', 'update', 'close', 'drop', 'why', 'hook'];
const FLAGS = ['brief', 'stdin'];
const stop = (msg) => { console.log(msg); process.exit(1); };
const opts = {}; const positional = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]; const name = a.startsWith('--') ? a.slice(2) : null;
  if (name !== null && VALUED.includes(name)) { if (i + 1 >= argv.length) stop(`--${name} needs a value`); opts[name] = argv[++i]; }
  else if (name !== null && FLAGS.includes(name)) opts[name] = true;
  else if (name !== null) stop(`unknown option ${a}`);
  else positional.push(a);
}
if (opts.hook && !['claude', 'codex', 'copilot'].includes(opts.hook)) stop('--hook takes claude, codex or copilot');
if (opts.drop && !opts.why) stop('--drop needs --why <text>');

const pad = (n) => String(n).padStart(2, '0');
const today = process.env.TRACKER_TODAY || (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
const dayOf = (s) => { // days since the epoch for a leading real date, else null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(s ?? '');
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return new Date(t).toISOString().slice(0, 10) === m[0] ? t / 86400000 : null; // 2026-02-30 rolls over: not a date
};

// ---- where the tracker is -------------------------------------------------------------------------------
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
function locate(p) {
  const target = path.resolve(p);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return { file: target, dir: path.dirname(target) };
  let dir = target;
  try { dir = git(target, 'rev-parse', '--show-toplevel').trim(); } catch { /* not in a git repo: the folder itself */ }
  return { file: path.join(dir, NAME), dir };
}
let start = positional[0] ?? process.cwd();
if (opts.stdin) { try { start = JSON.parse(fs.readFileSync(0, 'utf8')).cwd || start; } catch { /* no payload: the current folder */ } }
const { file, dir } = locate(start);

// ---- parse and check (TR-1 … TR-6) -----------------------------------------------------------------------
function parse(text) {
  const fails = []; const fail = (code, msg) => fails.push(`  ${code}  ${msg}`);
  const lines = text.replace(/\n$/, '').split(/\r?\n/);
  const items = []; const seen = new Map(); let section = null; let cur = null; let preambleEnd = lines.length;
  lines.forEach((line, i) => {
    const n = i + 1;
    if (line.startsWith('## ')) {
      const name = line.slice(3).trim();
      if (section === null) preambleEnd = i;
      if (name !== 'Open' && name !== 'Done') { fail('TR-1', `line ${n}: section "${line}" is not Open or Done`); section = 'other'; }
      else if (seen.has(name)) { fail('TR-1', `line ${n}: section "${line}" appears twice`); section = 'other'; }
      else { seen.set(name, n); section = name; }
      cur = null; return;
    }
    if (section === null || section === 'other') return; // the free text on top; an unknown section's lines
    if (line.startsWith('### ')) {
      const m = /^### T-(\d+) +(\S.*)$/.exec(line);
      if (!m) { fail('TR-2', `line ${n}: "${line}" is not "### T-<n> <title>"`); cur = { skip: true }; return; }
      cur = { id: `T-${m[1]}`, n: +m[1], title: m[2].trim(), section, line: n, fields: new Map(), twice: [] };
      items.push(cur); return;
    }
    if (line.trim() === '') return;
    const f = /^- ([a-z-]+): *(.*)$/.exec(line);
    if (f && cur) { if (!cur.skip) { if (cur.fields.has(f[1])) cur.twice.push(f[1]); else cur.fields.set(f[1], f[2].trim()); } return; }
    fail('TR-1', `line ${n}: "${line}" is not an item heading, a "- key: value" line or blank`);
  });
  if (!seen.has('Open')) fail('TR-1', 'there is no "## Open" section');
  if (!seen.has('Done')) fail('TR-1', 'there is no "## Done" section');
  if (seen.has('Open') && seen.has('Done') && seen.get('Done') < seen.get('Open')) fail('TR-1', '"## Done" comes before "## Open"');
  const byId = new Map();
  for (const it of items) { if (byId.has(it.id)) fail('TR-2', `${it.id} is used twice (lines ${byId.get(it.id).line} and ${it.line})`); else byId.set(it.id, it); }
  for (const it of items) {
    const v = (k) => it.fields.get(k);
    for (const k of it.twice) fail('TR-3', `${it.id}: "${k}" is given twice`);
    for (const k of it.fields.keys()) if (!KEYS.includes(k)) fail('TR-3', `${it.id}: unknown key "${k}"`);
    const status = v('status');
    if (status === undefined) fail('TR-3', `${it.id}: needs "status"`);
    else if (!NEEDS[status]) fail('TR-4', `${it.id}: status "${status}" is not open, doing, waiting, done or dropped`);
    else for (const k of NEEDS[status]) if (!it.fields.has(k)) fail('TR-3', `${it.id}: status ${status} needs "${k}"`);
    if (it.fields.has('priority') && !PRIORITIES.includes(v('priority'))) fail('TR-4', `${it.id}: priority "${v('priority')}" is not high, normal or low`);
    for (const k of DATED) if (it.fields.has(k) && dayOf(v(k)) === null) fail('TR-4', `${it.id}: ${k} "${v(k)}" does not start with a date (YYYY-MM-DD)`);
    if (NEEDS[status] && SECTION_OF[status] !== it.section) fail('TR-5', `${it.id}: status ${status} belongs under "## ${SECTION_OF[status]}"`);
    if (it.fields.has('done-when') && !parseCheck(v('done-when'))) fail('TR-6', `${it.id}: done-when "${v('done-when')}" is not "merged <ref> into <ref>", "exists <path>", "gone <path>", "commit <text>" or "no-stash <text>"`);
  }
  return { preamble: lines.slice(0, preambleEnd).join('\n'), items, fails };
}
function parseCheck(s) {
  let m;
  if ((m = /^merged (\S+) into (\S+)$/.exec(s))) return { kind: 'merged', a: m[1], b: m[2] };
  if ((m = /^(exists|gone) (.+)$/.exec(s))) return { kind: m[1], path: m[2] };
  if ((m = /^(commit|no-stash) (.+)$/.exec(s))) return { kind: m[1], text: m[2] };
  return null;
}

// ---- what the open items say now (TR-7 … TR-10) ----------------------------------------------------------------
let inGit = null;
function evaluate(check) { // { holds, evidence } or { error }
  if (check.kind === 'exists' || check.kind === 'gone') {
    const there = fs.existsSync(path.join(dir, check.path));
    return { holds: check.kind === 'exists' ? there : !there, evidence: `${check.path} ${check.kind === 'exists' ? 'exists' : 'is gone'}` };
  }
  if (inGit === null) { try { inGit = git(dir, 'rev-parse', '--is-inside-work-tree').trim() === 'true'; } catch { inGit = false; } }
  if (!inGit) return { error: 'not a git repository' };
  if (check.kind === 'merged') {
    const ref = (r) => [r, `origin/${r}`].find((x) => { try { git(dir, 'rev-parse', '--verify', '--quiet', `${x}^{commit}`); return true; } catch { return false; } });
    const a = ref(check.a); const b = ref(check.b);
    if (!a || !b) { const r = a ? check.b : check.a; return { error: `no ref "${r}" (nor "origin/${r}")` }; }
    let holds = true; try { git(dir, 'merge-base', '--is-ancestor', a, b); } catch { holds = false; }
    return { holds, evidence: `${check.a} is merged into ${check.b}` };
  }
  if (check.kind === 'commit') return { holds: git(dir, 'log', '-F', `--grep=${check.text}`, '-n', '1', '--format=%H', 'HEAD').trim() !== '', evidence: `a commit on HEAD mentions "${check.text}"` };
  return { holds: !git(dir, 'stash', 'list', '--format=%gs').split('\n').some((l) => l.includes(check.text)), evidence: `no stash mentions "${check.text}"` };
}
function state(it) {
  const v = (k) => it.fields.get(k);
  const s = { it, status: v('status'), priority: v('priority') ?? 'normal' };
  if (v('done-when')) { const r = evaluate(parseCheck(v('done-when'))); if (r.error) s.cannot = r.error; else if (r.holds) s.done = r.evidence; }
  if (v('due') && dayOf(v('due')) < dayOf(today)) s.overdue = v('due');
  const since = dayOf(today) - dayOf(v('updated') ?? v('from'));
  if (since > STALE_DAYS) s.stale = since;
  s.rank = s.done ? 0 : s.overdue ? 1 : s.priority === 'high' ? 2 : s.status === 'doing' ? 3 : s.status === 'waiting' ? 4 : s.priority === 'low' ? 6 : 5;
  return s;
}

// ---- output --------------------------------------------------------------------------------------------------
const read = () => (fs.existsSync(file) ? parse(fs.readFileSync(file, 'utf8')) : null);
const openOf = (m) => m.items.filter((it) => it.section === 'Open');
function brief(m) {
  if (m.fails.length) return [`${NAME}: ${m.fails.length} format error${m.fails.length === 1 ? '' : 's'}; run: node ${TOOL} to see it`];
  const states = openOf(m).map(state).sort((a, b) => a.rank - b.rank); // stable: oldest first within a rank
  if (!states.length) return [];
  const count = (f) => states.filter(f).length;
  const notes = [['looks done', (s) => s.done], ['overdue', (s) => s.overdue], ['high', (s) => s.priority === 'high'], ['doing', (s) => s.status === 'doing'], ['waiting', (s) => s.status === 'waiting'], ['stale', (s) => s.stale]]
    .map(([label, f]) => [count(f), label]).filter(([n]) => n).map(([n, label]) => `${n} ${label}`);
  const lines = [`${NAME}: ${states.length} open${notes.length ? ` — ${notes.join(', ')}` : ''}`];
  for (const s of states) {
    const flags = [];
    if (s.done) flags.push(`looks done: ${s.done}`);
    if (s.overdue) flags.push(`overdue: due ${s.overdue}`);
    if (s.priority === 'high') flags.push('high priority');
    if (s.status === 'doing') flags.push('doing');
    if (s.status === 'waiting') flags.push(`waiting on ${s.it.fields.get('waiting-on')}`);
    if (s.stale) flags.push(`stale: ${s.stale} days`);
    if (s.priority === 'low') flags.push('low priority');
    flags.push(`next: ${s.it.fields.get('next')}`);
    lines.push(`- ${s.it.id} ${s.it.title} · ${flags.join(' · ')}`);
  }
  return lines;
}

if (opts.brief || opts.hook) {
  const m = read();
  const lines = m ? brief(m) : [];
  if (!lines.length) process.exit(0);
  const context = `${lines.join('\n')}\n\n${GUIDE}`;
  if (opts.brief) console.log(lines.join('\n'));
  else if (opts.hook === 'copilot') console.log(JSON.stringify({ additionalContext: context }, null, 2));
  else {
    const shown = lines.slice(0, 6); const more = lines.length - shown.length;
    console.log(JSON.stringify({ systemMessage: [...shown, ...(more ? [`… and ${more} more`] : [])].join('\n'), hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }, null, 2));
  }
  process.exit(0);
}

// ---- edits ---------------------------------------------------------------------------------------------------
const FIELD_OPTS = ['status', 'priority', 'next', 'waiting-on', 'due', 'done-when', 'note', 'links'];
function render(m) {
  const out = [(m.preamble.trim() || '# Tracker'), '', '## Open', ''];
  const item = (it) => [`### ${it.id} ${it.title}`, ...KEYS.filter((k) => it.fields.has(k)).map((k) => `- ${k}: ${it.fields.get(k)}`), ''];
  for (const it of m.items.filter((x) => x.section === 'Open')) out.push(...item(it));
  out.push('## Done', '');
  for (const it of m.items.filter((x) => x.section === 'Done')) out.push(...item(it));
  return `${out.join('\n').trimEnd()}\n`;
}
if (opts.add || opts.update || opts.close || opts.drop) {
  const created = !fs.existsSync(file);
  const m = created ? parse(`${PREAMBLE}\n\n## Open\n\n## Done\n`) : read();
  if (m.fails.length) { console.log(`${NAME} has format errors; fix them first:`); for (const f of m.fails) console.log(f); process.exit(1); }
  const setFields = (it) => { for (const k of FIELD_OPTS) if (opts[k] !== undefined) it.fields.set(k, opts[k]); };
  let done;
  if (opts.add) {
    const it = { id: `T-${Math.max(0, ...m.items.map((x) => x.n)) + 1}`, title: opts.add, section: 'Open', fields: new Map([['status', 'open']]) };
    setFields(it); it.fields.set('from', opts.from ? `${today} · ${opts.from}` : today);
    m.items.push(it); done = `added ${it.id} to ${NAME}`;
  } else {
    const id = opts.update ?? opts.close ?? opts.drop;
    const it = m.items.find((x) => x.id === id && x.section === 'Open');
    if (!it) stop(`no open item ${id} in ${NAME}`);
    if (opts.update) { setFields(it); it.fields.set('updated', today); done = `updated ${id}`; }
    else {
      it.fields.set('status', opts.close ? 'done' : 'dropped');
      it.fields.set('closed', opts.note && opts.close ? `${today} · ${opts.note}` : today);
      if (opts.drop) it.fields.set('why', opts.why);
      m.items.splice(m.items.indexOf(it), 1);
      it.section = 'Done';
      const firstDone = m.items.findIndex((x) => x.section === 'Done');
      m.items.splice(firstDone < 0 ? m.items.length : firstDone, 0, it);
      done = `${opts.close ? 'closed' : 'dropped'} ${id}`;
    }
  }
  const text = render(m);
  const after = parse(text);
  if (after.fails.length) { console.log(`${NAME} not changed:`); for (const f of after.fails) console.log(f); process.exit(1); }
  fs.writeFileSync(file, text);
  if (created) {
    let exclude = null;
    try { exclude = path.resolve(dir, git(dir, 'rev-parse', '--git-path', 'info/exclude').trim()); } catch { /* not a git repo */ }
    if (exclude) {
      const has = fs.existsSync(exclude) && fs.readFileSync(exclude, 'utf8').split('\n').includes(`/${NAME}`);
      if (!has) { fs.mkdirSync(path.dirname(exclude), { recursive: true }); fs.appendFileSync(exclude, `${fs.existsSync(exclude) && !fs.readFileSync(exclude, 'utf8').endsWith('\n') ? '\n' : ''}/${NAME}\n`); }
      console.log(`created ${NAME} (local only: listed in .git/info/exclude; run git add -f ${NAME} to share it)`);
    } else console.log(`created ${NAME}`);
  }
  console.log(done);
  process.exit(0);
}

// ---- check ---------------------------------------------------------------------------------------------------
const m = read();
if (!m) { console.log(`no ${NAME} in ${dir}: nothing to check`); process.exit(0); }
const fails = m.fails; const warns = [];
const warn = (code, msg) => warns.push(`  warn  ${code}  ${msg}`);
if (!fails.length) for (const it of openOf(m)) {
  const s = state(it);
  if (s.done) warn('TR-7', `${it.id} looks done: ${s.done}; close it with --close ${it.id}`);
  if (s.overdue) warn('TR-8', `${it.id} is overdue: due ${s.overdue}`);
  if (s.stale) warn('TR-9', `${it.id} is stale: no change for ${s.stale} days`);
  if (s.cannot) warn('TR-10', `${it.id}: cannot check "${it.fields.get('done-when')}": ${s.cannot}`);
}
console.log(`tracker check: ${path.basename(file)}, ${openOf(m).length} open, ${m.items.length - openOf(m).length} done`);
for (const w of warns) console.log(w);
if (fails.length) { console.log(`FAIL (${fails.length})`); for (const f of fails) console.log(f); process.exit(1); }
console.log(`PASS (${warns.length} warning(s))`);
