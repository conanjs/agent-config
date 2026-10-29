#!/usr/bin/env node
// atlas.mjs — checks, writes and explains the atlas: the map of every repo, area, kind and file (atlas/v1).
//
// Usage: node atlas.mjs [atlas.yaml] [--repo <id>=<path>]… [--write | --explain <path>]
//   atlas.yaml   default: <this tool>/../atlas.yaml; agent-config's root is two folders above it
//   --repo       use this folder for a repo instead of its registered root (e.g. a reference repo clone)
//   --write      regenerate index.md and map/<repo>/<area>.md, then check
//   --explain    print a file's place in the tree, its kind's facts and the files that link to it
//
// Checks (schemas/atlas.schema.md): AT-1 every file has a kind; AT-2 every kind has a file; AT-3 named paths exist;
// AT-4 the tree is whole; AT-5 generated pages are current; AT-6 ids, fields and edges; AT-7 absent repos (warn).
// No dependencies: it runs installed under ~/.copilot as well as in the repo.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const take = (n) => { const i = args.indexOf(n); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const write = args.includes('--write'); if (write) args.splice(args.indexOf('--write'), 1);
const explain = take('--explain');
const overrides = new Map();
for (let v = take('--repo'); v !== undefined; v = take('--repo')) { const [id, ...p] = v.split('='); overrides.set(id, path.resolve(p.join('='))); }
const here = path.dirname(fileURLToPath(import.meta.url));
const atlasFile = path.resolve(args[0] ?? path.join(here, '..', 'atlas.yaml'));
const atlasDir = path.dirname(atlasFile);
const home = path.resolve(atlasDir, '..', '..'); // agent-config's root
const posix = (p) => p.split(path.sep).join('/');
const NONE = '—';

const fails = []; const warns = [];
const fail = (code, msg) => fails.push(`  ${code}  ${msg}`);
const warn = (code, msg) => warns.push(`  warn  ${code}  ${msg}`);

// ---- registry: one flow mapping per line under repos:, areas:, kinds:, edges: ---------------------------
function splitTop(s) {
  const out = []; let cur = ''; let q = null; let depth = 0;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
const unquote = (v) => v.trim().replace(/^(["'])([\s\S]*)\1$/, '$2');
function flowMap(line) {
  const obj = {};
  for (const part of splitTop(line.trim().replace(/^-\s*\{/, '').replace(/\}\s*$/, ''))) {
    const i = part.indexOf(':');
    if (i > 0) obj[part.slice(0, i).trim()] = unquote(part.slice(i + 1));
  }
  return obj;
}
function readRegistry(file) {
  const reg = { repos: [], areas: [], kinds: [], edges: [] };
  let key = null;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const top = line.match(/^(repos|areas|kinds|edges):\s*$/);
    if (top) { key = top[1]; return; }
    if (/^\s+-\s*\{/.test(line) && key) reg[key].push({ ...flowMap(line), line: i + 1 });
  });
  return reg;
}
const reg = readRegistry(atlasFile);

// ---- AT-6: ids, required fields, edges -----------------------------------------------------------------
const REQUIRED = {
  repos: ['id', 'root', 'ref', 'url', 'title', 'summary'],
  areas: ['id', 'repo', 'parent', 'title', 'summary'],
  kinds: ['id', 'area', 'home', 'title', 'summary', 'schema', 'index', 'checked-by', 'tests', 'deploy'],
  edges: ['from', 'to', 'via', 'checked-by'],
};
for (const [list, fields] of Object.entries(REQUIRED)) {
  const seen = new Set();
  for (const e of reg[list]) {
    for (const f of fields) if (!e[f]) fail('AT-6', `atlas.yaml:${e.line}: ${list} entry lacks "${f}"`);
    if (list === 'edges') continue;
    if (seen.has(e.id)) fail('AT-6', `atlas.yaml:${e.line}: ${list} id "${e.id}" is used twice`);
    seen.add(e.id);
  }
}
const repoById = new Map(reg.repos.map((r) => [r.id, r]));
const areaById = new Map(reg.areas.map((a) => [a.id, a]));
const kindById = new Map(reg.kinds.map((k) => [k.id, k]));
for (const e of reg.edges) for (const end of ['from', 'to']) if (e[end] && !kindById.has(e[end])) fail('AT-6', `atlas.yaml:${e.line}: edge ${end} "${e[end]}" is not a kind`);

// ---- AT-4: every kind and area reaches its repo by parent links ------------------------------------------
const chain = (areaId) => { // area ids from this one up to the repo, or null when broken
  const out = []; const seen = new Set();
  for (let a = areaById.get(areaId); a; a = a.parent === 'root' ? null : areaById.get(a.parent)) {
    if (seen.has(a.id)) return null;
    seen.add(a.id); out.push(a.id);
    if (a.parent !== 'root' && !areaById.has(a.parent)) return null;
  }
  return out.length ? out : null;
};
for (const a of reg.areas) {
  if (!repoById.has(a.repo)) fail('AT-4', `area ${a.id}: repo "${a.repo}" is not a repo`);
  const parent = areaById.get(a.parent);
  if (a.parent !== 'root' && !parent) fail('AT-4', `area ${a.id}: parent "${a.parent}" is not an area`);
  else if (parent && parent.repo !== a.repo) fail('AT-4', `area ${a.id}: parent ${a.parent} is in repo ${parent.repo}, not ${a.repo}`);
  else if (!chain(a.id)) fail('AT-4', `area ${a.id}: its parents loop and never reach root`);
}
for (const k of reg.kinds) if (!areaById.has(k.area)) fail('AT-4', `kind ${k.id}: area "${k.area}" is not an area`);
const repoOfKind = (k) => areaById.get(k.area)?.repo;

// ---- files per repo ---------------------------------------------------------------------------------
function rootOf(repo) {
  if (overrides.has(repo.id)) return overrides.get(repo.id);
  const r = repo.root.replace('{{REFERENCE_REPOS_ROOT}}', process.env.REFERENCE_REPOS_ROOT || path.join(os.homedir(), 'agentic-sdlc-references'));
  return path.resolve(home, r);
}
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n').filter(Boolean);
function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.DS_Store'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out); else out.push(posix(path.relative(base, p)));
  }
  return out;
}
const isGitRoot = (dir) => { try { return path.resolve(git(dir, 'rev-parse', '--show-toplevel')[0]) === fs.realpathSync(dir); } catch { return false; } };
function listFiles(repo, root) {
  if (repo.ref && repo.ref !== NONE) return git(root, 'ls-tree', '-r', '--name-only', repo.ref);
  if (isGitRoot(root)) return git(root, 'ls-files', '--cached', '--others', '--exclude-standard').filter((f) => fs.existsSync(path.join(root, f)));
  return walk(root);
}

// The pages --write produces, per repo: map/<repo>/<area>.md for every area, plus index.md (agent-config's).
const mapRel = posix(path.relative(home, atlasDir));
const pagePath = (area) => `${mapRel}/map/${area.repo}/${area.id}.md`;
const generated = new Set([`${mapRel}/index.md`, ...reg.areas.map(pagePath)]);

const present = new Map(); // repo id -> { root, files: [path] }
for (const repo of reg.repos) {
  const root = rootOf(repo);
  let files = null;
  if (fs.existsSync(root)) {
    try { files = listFiles(repo, root); } catch (e) { warn('AT-7', `repo ${repo.id}: cannot list ${repo.ref} in ${root} (${String(e.stderr ?? e.message).trim().split('\n')[0]}); skipped`); }
  } else warn('AT-7', `repo ${repo.id}: ${root} not found; skipped (pass --repo ${repo.id}=<path>)`);
  if (!files) continue;
  if (path.resolve(root) === home) files = [...new Set([...files, ...generated])];
  present.set(repo.id, { root, files: files.sort() });
}
// A repo whose folder sits inside another repo's folder (a nested clone) owns its files, whether or not it is present;
// the outer repo does not list them.
for (const [id, r] of present) {
  const inner = reg.repos.filter((o) => o.id !== id).map(rootOf).filter((o) => path.resolve(o) !== path.resolve(r.root) && path.resolve(o).startsWith(path.resolve(r.root) + path.sep))
    .map((o) => posix(path.relative(r.root, o)) + '/');
  if (inner.length) r.files = r.files.filter((f) => !inner.some((d) => f.startsWith(d)));
}

// ---- globs and kinds ----------------------------------------------------------------------------------
// Glob to regex source: ** (any depth), * (no /), ? (one char), {a,b} (alternatives, which may nest and hold globs).
function globSource(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; } }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const alts = []; let depth = 0; let cur = ''; let j = i + 1;
      for (; j < glob.length; j++) {
        const d = glob[j];
        if (d === '{') depth++;
        if (d === '}' && depth-- === 0) break;
        if (d === ',' && depth === 0) { alts.push(cur); cur = ''; } else cur += d;
      }
      alts.push(cur);
      re += `(?:${alts.map(globSource).join('|')})`;
      i = j;
    } else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return re;
}
const globRe = (glob) => new RegExp(`^${globSource(glob)}$`);
const kindRes = new Map(reg.kinds.map((k) => [k.id, globRe(k.home ?? '')]));
const placed = new Map(); // repo id -> Map(kind id -> [files])
for (const [repoId, { files }] of present) {
  const kinds = reg.kinds.filter((k) => repoOfKind(k) === repoId);
  const byKind = new Map(kinds.map((k) => [k.id, []]));
  for (const f of files) {
    const k = kinds.find((x) => kindRes.get(x.id).test(f));
    if (k) byKind.get(k.id).push(f); else fail('AT-1', `${repoId}: ${f} belongs to no kind`);
  }
  for (const k of kinds) if (!byKind.get(k.id).length) fail('AT-2', `kind ${k.id}: "${k.home}" matches no file in ${repoId}`);
  placed.set(repoId, byKind);
}

// ---- AT-3: the paths a kind names exist -----------------------------------------------------------------
for (const k of reg.kinds) {
  const r = present.get(repoOfKind(k));
  if (!r) continue;
  // A page this tool generates counts as present: --write creates it, and AT-5 checks it.
  const made = (p) => path.resolve(r.root) === home && generated.has(p);
  for (const f of ['schema', 'index', 'tests']) if (k[f] && k[f] !== NONE && !made(k[f]) && !fs.existsSync(path.join(r.root, k[f]))) fail('AT-3', `kind ${k.id}: ${f} ${k[f]} does not exist`);
}

// ---- pages ------------------------------------------------------------------------------------------
const BANNER = '<!-- Generated by copilot/atlas/tools/atlas.mjs from atlas.yaml. Do not edit: change atlas.yaml, then run `node copilot/atlas/tools/atlas.mjs --write`. -->';
const cell = (v) => (!v || v === NONE ? NONE : v);
const code = (v) => (!v || v === NONE ? NONE : `\`${v}\``);
const childAreas = (repoId, parent) => reg.areas.filter((a) => a.repo === repoId && a.parent === parent);
const countIn = (repoId, areaId) => {
  const byKind = placed.get(repoId);
  if (!byKind) return null;
  const sub = (id) => reg.kinds.filter((k) => k.area === id).reduce((n, k) => n + (byKind.get(k.id)?.length ?? 0), 0) + childAreas(repoId, id).reduce((n, a) => n + sub(a.id), 0);
  return sub(areaId);
};
function renderIndex() {
  const lines = [BANNER, '', '# Atlas: where everything is', '',
    'The map of every repo, area, kind of file and file. Start here, or ask the `coordinator` role. Each area page lists every one of its files under its kind; `node copilot/atlas/tools/atlas.mjs --explain <path>` shows where one file sits, what checks it and what links to it. The registry and its rules: `atlas.yaml`, `schemas/atlas.schema.md`.', '', '## Tree', ''];
  const tree = (repoId, parent, depth) => {
    for (const a of childAreas(repoId, parent)) {
      // Counts only for working-tree repos: a ref-listed repo is present on some machines only, and the page must not change with that.
      const n = repoById.get(repoId).ref === NONE ? countIn(repoId, a.id) : null;
      lines.push(`${'  '.repeat(depth)}- [${a.title}](map/${a.repo}/${a.id}.md) — ${a.summary}${n === null ? '' : ` (${n} ${n === 1 ? 'file' : 'files'})`}`);
      tree(repoId, a.id, depth + 1);
    }
  };
  for (const r of reg.repos) {
    lines.push(`- **${r.title}** (\`${r.id}\`${r.ref !== NONE ? `, at \`${r.ref}\`` : ''}) — ${r.summary}`);
    tree(r.id, 'root', 1);
  }
  lines.push('', '## Kinds', '', '| Kind | Area | Where | Schema | Index | Checked by | Scenarios | Installed to |', '|---|---|---|---|---|---|---|---|');
  for (const k of reg.kinds) lines.push(`| [${k.title}](map/${repoOfKind(k)}/${k.area}.md#${k.id}) | ${areaById.get(k.area)?.title ?? k.area} | ${code(k.home)} | ${code(k.schema)} | ${code(k.index)} | ${cell(k['checked-by'])} | ${code(k.tests)} | ${code(k.deploy)} |`);
  lines.push('', '## Chains', '', 'How kinds point at each other. Each chain is checked where the last column says.', '', '| From | To | How | Checked by |', '|---|---|---|---|');
  for (const e of reg.edges) lines.push(`| ${kindById.get(e.from)?.title ?? e.from} | ${kindById.get(e.to)?.title ?? e.to} | ${e.via} | ${cell(e['checked-by'])} |`);
  return lines.join('\n') + '\n';
}
function renderArea(a) {
  const repo = repoById.get(a.repo);
  const parent = a.parent === 'root' ? null : areaById.get(a.parent);
  const up = parent ? `[${parent.title}](${parent.id}.md)` : `[Atlas](../../index.md) › ${repo.title}`;
  const link = (f) => (repo.url !== NONE ? `[\`${f}\`](${repo.url}/${f})` : `[\`${f}\`](${posix(path.relative(path.dirname(path.join(home, pagePath(a))), path.join(present.get(a.repo).root, f)))})`);
  const lines = [BANNER, '', `# ${a.title}`, '', a.summary, '', `Up: ${up}`];
  const subs = childAreas(a.repo, a.id);
  if (subs.length) lines.push('', `Sub-areas: ${subs.map((s) => `[${s.title}](${s.id}.md)`).join(' · ')}`);
  for (const k of reg.kinds.filter((x) => x.area === a.id)) {
    lines.push('', `## ${k.title}`, '', `<a id="${k.id}"></a>${k.summary}`, '',
      `Where: ${code(k.home)} · Schema: ${code(k.schema)} · Index: ${code(k.index)} · Checked by: ${cell(k['checked-by'])} · Scenarios: ${code(k.tests)} · Installed to: ${code(k.deploy)}`, '');
    for (const f of placed.get(a.repo).get(k.id)) lines.push(`- ${link(f)}`);
  }
  return lines.join('\n') + '\n';
}
const pages = new Map(); // agent-config-relative path -> text
if (present.has(reg.repos[0]?.id)) pages.set(`${mapRel}/index.md`, renderIndex());
for (const a of reg.areas) if (placed.has(a.repo)) pages.set(pagePath(a), renderArea(a));

if (write && !fails.length) for (const [p, text] of pages) { fs.mkdirSync(path.dirname(path.join(home, p)), { recursive: true }); fs.writeFileSync(path.join(home, p), text); }
// AT-5: every page of a present repo equals what --write produces. Checked only when nothing else fails:
// --write refuses to write until the registry is clean, so "run with --write" would not help yet.
if (!fails.length) for (const [p, text] of pages) {
  const f = path.join(home, p);
  if (!fs.existsSync(f)) fail('AT-5', `${p} is missing; run with --write`);
  else if (fs.readFileSync(f, 'utf8') !== text) fail('AT-5', `${p} is out of date; run with --write`);
}

// ---- --explain ----------------------------------------------------------------------------------------
if (explain) {
  const target = posix(path.relative(home, path.resolve(explain)));
  const hit = [...placed].flatMap(([repoId, byKind]) => [...byKind].filter(([, fs_]) => fs_.includes(target) || fs_.includes(explain)).map(([kid]) => [repoId, kid]))[0];
  if (!hit) { console.log(`${target}: not on the map (no present repo has it)`); process.exit(1); }
  const [repoId, kid] = hit; const k = kindById.get(kid); const file = placed.get(repoId).get(kid).includes(target) ? target : explain;
  const up = chain(k.area).map((id) => areaById.get(id).title).reverse();
  console.log(`${file}`);
  console.log(`  place:        ${[repoById.get(repoId).title, ...up, k.title].join(' › ')}`);
  console.log(`  kind:         ${k.id} — ${k.summary}`);
  for (const [label, f] of [['schema', 'schema'], ['index', 'index'], ['checked by', 'checked-by'], ['scenarios', 'tests'], ['installed to', 'deploy']]) console.log(`  ${(label + ':').padEnd(14)}${cell(k[f])}`);
  const root = present.get(repoId).root; const base = path.basename(file);
  const from = present.get(repoId).files.filter((f) => f !== file && /\.(md|mjs|js|ts|yaml|yml|json|toml|sh|ps1)$/.test(f) && fs.existsSync(path.join(root, f)) && (() => {
    const t = fs.readFileSync(path.join(root, f), 'utf8');
    if (t.includes(file)) return true;
    for (const m of t.matchAll(/\]\(([^)#\s]+)/g)) if (m[1].endsWith(base) && posix(path.normalize(path.join(path.dirname(f), m[1]))) === file) return true;
    return false;
  })());
  console.log(`  linked from:${from.length ? '' : ` ${NONE}`}`);
  for (const f of from) console.log(`    ${f}`);
  process.exit(0);
}

// ---- report -------------------------------------------------------------------------------------------
const nFiles = [...present.values()].reduce((n, r) => n + r.files.length, 0);
console.log(`atlas validate: ${reg.repos.length} repos (${present.size} present), ${reg.areas.length} areas, ${reg.kinds.length} kinds, ${nFiles} files${write ? ', pages written' : ''}`);
for (const w of warns) console.log(w);
if (fails.length) { console.log(`FAIL (${fails.length})`); for (const x of fails) console.log(x); process.exit(1); }
console.log(`PASS (${warns.length} warning(s))`);
