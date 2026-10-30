#!/usr/bin/env node
// atlas.mjs — checks, writes and explains the atlas: the map of every repo, area, kind and file (atlas/v1).
//
// Usage: node atlas.mjs [atlas.yaml] [--repo <id>=<path>]… [--write | --explain <path>]
//   atlas.yaml   default: <this tool>/../atlas.yaml; agent-config's root is two folders above it
//   --repo       use this folder for a repo instead of its registered root (e.g. a reference repo clone)
//   --write      regenerate index.md and map/<repo>/<area>.md, then check
//   --explain    print a file's place in the tree, its kind's facts, the files of any present repo that name it by
//                path (direct) or by name alone (nearest file wins), and the files that depend on it through declared edges (chains,
//                nearest first); for a folder, the kinds of its files
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
for (const k of reg.kinds) if (k.cites && k.cites !== NONE && !repoById.has(k.cites)) fail('AT-6', `atlas.yaml:${k.line}: kind ${k.id} cites "${k.cites}", which is not a repo`);

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

// ---- references between files, across the present repos (for --explain) -------------------------------
// A path in a file's text counts as a reference when it names a file of a present repo, written:
//   relative to the citing file (`../design/x.md`, a Markdown link), or repo-relative (`copilot/…/x.md`), or relative
//   to a folder above the citing file (`foundations/design/x.md` in a role file): then the nearest file with that
//   ending wins. Repo-relative and ending paths are looked up first in the repo the citing file's kind `cites`, then
//   in its own repo. The installed form (`{{AGENT_HOME}}/…`, `~/.copilot/…`) is a path in the home repo, from any repo.
//   A web link `<repo web>/(blob|tree|raw)/<ref>/<path>` is a path in that repo (`web`, or `url` without its ref).
//   A `.js` path with no such file is read as the `.ts` file a TypeScript ESM import means, and a path that starts
//   with an alias of `compilerOptions.paths` (`@/…`) as the path it stands for. The aliases are those of the nearest
//   tsconfig.json at or above the citing file's folder, with what it inherits through `extends` (relative files only;
//   later entries win, `paths` whole): relative to `baseUrl` when one is set, else to the file that sets `paths`, and
//   `${configDir}` is the folder of the tsconfig.json in use.
// A name without a path is a mention: a hyphenated or PascalCase word equal to a file's name less its extension
// (`module-boundaries`, `CompositionRoot`), in the cited repo first, then the own one. When several files have the
// name, the ones nearest the citing file count (most leading folders in common), a tie marked. A one-word name counts
// only when Markdown writes it as code (`setup`), and only when one file is nearest. A file's own name is not a
// mention. Mentions are listed apart and make no chain.
// The generated pages are left out: they list every file, which says nothing about dependencies.
const TEXT = /\.(md|mjs|js|ts|yaml|yml|json|toml|sh|ps1|feature)$/;
const PATHLIKE = /[\w{}~.@%\\/-]*[\w@-]+\.(?:md|mjs|js|ts|yaml|yml|json|toml|sh|ps1|feature)(?!\w)/g;
const CODE_WORD = /`([A-Za-z][A-Za-z0-9_]*)`/g; // a one-word name written as Markdown code
const NAME = /(?<![\w./\\-])(?:[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+)(?![\w\\/-]|\.\w)/g;
const homeId = [...present].find(([, r]) => path.resolve(r.root) === home)?.[0];
const webOf = (r) => (r.web && r.web !== NONE ? r.web : r.url && r.url !== NONE ? r.url.replace(/\/(?:blob|tree)\/[^/]+\/?$/, '') : null);
// The texts of a repo's files: a ref-listed repo is read at its ref (one `git cat-file --batch`), others from disk.
function textsOf(repoId) {
  const repo = repoById.get(repoId); const { root, files } = present.get(repoId);
  const wanted = files.filter((f) => TEXT.test(f) && !(repoId === homeId && generated.has(f)));
  const out = new Map();
  if (repo.ref && repo.ref !== NONE) {
    const buf = execFileSync('git', ['-C', root, 'cat-file', '--batch'], { input: wanted.map((f) => `${repo.ref}:${f}\n`).join(''), maxBuffer: 1 << 30 });
    let at = 0;
    for (const f of wanted) {
      const eol = buf.indexOf(10, at); const head = buf.toString('utf8', at, eol).split(' ');
      if (head[1] === 'missing') { at = eol + 1; continue; }
      const size = Number(head[2]);
      out.set(f, buf.toString('utf8', eol + 1, eol + 1 + size)); at = eol + 1 + size + 1;
    }
  } else for (const f of wanted) if (fs.existsSync(path.join(root, f))) out.set(f, fs.readFileSync(path.join(root, f), 'utf8'));
  return out;
}
function references() {
  const key = (repoId, f) => `${repoId}:${f}`;
  const idx = new Map(); const kindOf = new Map();
  for (const [repoId, { files }] of present) {
    const byBase = new Map(); const byStem = new Map();
    for (const f of files) {
      const b = path.posix.basename(f); const stem = b.replace(/\.[^.]+$/, '');
      if (!byBase.has(b)) byBase.set(b, []); byBase.get(b).push(f);
      if (!byStem.has(stem)) byStem.set(stem, []); byStem.get(stem).push(f);
    }
    idx.set(repoId, { set: new Set(files), byBase, byStem });
    for (const [kid, fs_] of placed.get(repoId)) for (const f of fs_) kindOf.set(key(repoId, f), kid);
  }
  const depth = (a, b) => { const x = a.split('/'); const y = b.split('/'); let n = 0; while (n < x.length - 1 && n < y.length - 1 && x[n] === y[n]) n++; return n; };
  const inRepo = (repoId, t, citing) => { // repo-relative, then by ending (nearest to the citing file)
    const r = idx.get(repoId); if (!r) return null;
    if (r.set.has(t)) return t;
    const bare = t.replace(/^(\.\.?\/)+/, '');
    if (!bare.includes('/')) return null;
    const cands = (r.byBase.get(path.posix.basename(bare)) ?? []).filter((f) => f.endsWith(`/${bare}`));
    return cands.sort((a, b) => depth(b, citing) - depth(a, citing))[0] ?? null;
  };
  // TypeScript path aliases (`"@/*": ["./src/*"]`), longest prefix first, per tsconfig.json; a file uses the nearest one.
  const texts = new Map([...present.keys()].map((id) => [id, textsOf(id)]));
  const jsonc = (t) => JSON.parse(t.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? '').replace(/,(\s*[}\]])/g, '$1'));
  // The options a config ends with: its bases' first (in order), then its own. Each relative path is read from the file
  // that sets it. A package base is not in the repo, and a loop stops where it closes.
  const options = (t, file, seen = new Set()) => {
    let json; try { json = jsonc(t.get(file)); } catch (e) { if (e instanceof SyntaxError) return {}; throw e; } // not JSON: no options
    const out = {}; seen.add(file);
    for (const ext of [json.extends ?? []].flat()) {
      if (typeof ext !== 'string' || !ext.startsWith('.')) continue;
      const p = posix(path.normalize(path.join(path.dirname(file), ext)));
      const base = [p, `${p}.json`].find((x) => t.has(x));
      if (base && !seen.has(base)) Object.assign(out, options(t, base, seen));
    }
    const co = json.compilerOptions ?? {};
    if (co.paths) Object.assign(out, { paths: co.paths, pathsDir: path.dirname(file) });
    if (typeof co.baseUrl === 'string') out.baseUrl = path.join(path.dirname(file), co.baseUrl);
    return out;
  };
  const aliases = new Map(); // repo id -> Map(tsconfig.json path -> [[alias prefix, folder]])
  for (const [repoId, t] of texts) {
    const byConfig = new Map();
    for (const file of t.keys()) {
      if (path.posix.basename(file) !== 'tsconfig.json') continue;
      const o = options(t, file);
      const dir = (p) => { const d = posix(path.normalize(p.includes('${configDir}') ? p.replace('${configDir}', path.dirname(file)) : path.join(o.baseUrl ?? o.pathsDir, p))); return d === '.' ? '' : d.endsWith('/') ? d : `${d}/`; };
      byConfig.set(file, Object.entries(o.paths ?? {}).filter(([k, v]) => k.endsWith('/*') && v[0]?.endsWith('*'))
        .map(([k, v]) => [k.slice(0, -1), dir(v[0].slice(0, -1))]).sort((a, b) => b[0].length - a[0].length));
    }
    aliases.set(repoId, byConfig);
  }
  const aliasesFor = (repoId, citing) => { // the nearest tsconfig.json at or above the citing file's folder
    const byConfig = aliases.get(repoId);
    for (let d = path.posix.dirname(citing); ; d = path.posix.dirname(d)) {
      const c = byConfig.get(d === '.' ? 'tsconfig.json' : `${d}/tsconfig.json`);
      if (c) return c;
      if (d === '.') return [];
    }
  };
  const resolve = (token, repoId, citing, cites) => {
    const alias = aliasesFor(repoId, citing).find(([from]) => token.startsWith(from));
    if (alias) { const f = inRepo(repoId, alias[1] + token.slice(alias[0].length), citing) ?? inRepo(repoId, alias[1] + token.slice(alias[0].length).replace(/\.js$/, '.ts').replace(/\.mjs$/, '.mts'), citing); return f ? [repoId, f] : null; }
    const t0 = token.replace(/\\/g, '/');
    const t = t0.replace(/^\{\{AGENT_HOME\}\}\//, 'copilot/').replace(/^~\/\.copilot\//, 'copilot/').replace(/^%USERPROFILE%\/\.copilot\//, 'copilot/');
    if (t !== t0) { const f = inRepo(homeId, t, citing); return f ? [homeId, f] : null; }
    const rel = posix(path.normalize(path.join(path.dirname(citing), t)));
    if (idx.get(repoId).set.has(rel)) return [repoId, rel];
    for (const r of cites ? [cites, repoId] : [repoId]) { const f = inRepo(r, t, citing); if (f) return [r, f]; }
    // TypeScript ESM imports name the compiled file: `./Widget.js` is `./Widget.ts` (`.mjs` → `.mts`).
    const ts = token.replace(/\.js$/, '.ts').replace(/\.mjs$/, '.mts');
    return ts !== token ? resolve(ts, repoId, citing, cites) : null;
  };
  const webs = reg.repos.filter((r) => present.has(r.id) && webOf(r)).map((r) => ({ r, re: new RegExp(`${webOf(r).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(?:blob|tree|raw)/([^/\\s]+)/([^\\s)\\]\`"'<>#?]+)`, 'g') }));
  const citedBy = new Map(); const named = new Map();
  const add = (m, to, from) => { if (to === from) return; if (!m.has(to)) m.set(to, new Set()); m.get(to).add(from); };
  for (const [repoId] of present) {
    for (const [f, text] of texts.get(repoId)) {
      const from = key(repoId, f);
      const k = kindById.get(kindOf.get(from)); const cites = k?.cites && k.cites !== NONE && present.has(k.cites) ? k.cites : null;
      for (const { r, re } of webs) for (const m of text.matchAll(re)) {
        const p = m[2].replace(/[.,;:]+$/, '');
        const target = webs.filter((w) => webOf(w.r) === webOf(r) && idx.get(w.r.id).set.has(p)).sort((a, b) => (b.r.ref === m[1]) - (a.r.ref === m[1]))[0];
        if (target) add(citedBy, key(target.r.id, p), from);
      }
      for (const m of text.matchAll(PATHLIKE)) { const to = resolve(m[0], repoId, f, cites); if (to) add(citedBy, key(...to), from); }
      const own = path.posix.basename(f).replace(/\.[^.]+$/, '');
      const mention = (w, oneWord) => {
        if (w === own) return;
        for (const r of cites ? [cites, repoId] : [repoId]) {
          const hits = (idx.get(r).byStem.get(w) ?? []).filter((h) => !(r === repoId && h === f));
          if (!hits.length) continue;
          const near = Math.max(...hits.map((h) => depth(h, f))); const top = hits.filter((h) => depth(h, f) === near);
          if (top.length === 1 || !oneWord) for (const h of top) { const to = key(r, h); if (!named.has(to)) named.set(to, new Map()); named.get(to).set(from, top.length); }
          return;
        }
      };
      for (const m of text.matchAll(NAME)) mention(m[0], false);
      if (f.endsWith('.md')) for (const m of text.matchAll(CODE_WORD)) if (!/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+$/.test(m[1])) mention(m[1], true);
    }
  }
  for (const [to, froms] of named) for (const f of citedBy.get(to) ?? []) froms.delete(f);
  return { citedBy, named, kindOf, key };
}

// ---- --explain ----------------------------------------------------------------------------------------
if (explain) {
  // The path is read relative to the folder of each present repo that contains it, innermost first.
  const abs = path.resolve(explain);
  const owners = [...present].filter(([, r]) => !path.relative(path.resolve(r.root), abs).startsWith('..')).sort(([, a], [, b]) => b.root.length - a.root.length);
  const target = owners.length ? posix(path.relative(owners[0][1].root, abs)) : posix(path.relative(home, abs));
  // A folder: the kinds of the files under it, where each sits, and its page.
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    const [repoId, r] = owners[0] ?? [];
    const dir = repoId ? posix(path.relative(r.root, abs)) : target;
    const under = repoId ? r.files.filter((f) => dir === '' || f.startsWith(`${dir}/`)) : [];
    const byKind = repoId ? reg.kinds.filter((k) => repoOfKind(k) === repoId).map((k) => [k, placed.get(repoId).get(k.id).filter((f) => under.includes(f))]).filter(([, fs_]) => fs_.length) : [];
    if (!byKind.length) { console.log(`${dir}/: no mapped files under this folder`); process.exit(1); }
    console.log(`${dir}/ (folder, ${under.length} ${under.length === 1 ? 'file' : 'files'})`);
    for (const [k, fs_] of byKind) console.log(`  ${k.id} (${fs_.length} ${fs_.length === 1 ? 'file' : 'files'}) — ${[repoById.get(repoId).title, ...chain(k.area).map((id) => areaById.get(id).title).reverse(), k.title].join(' › ')} — ${pagePath(areaById.get(k.area))}#${k.id}`);
    process.exit(0);
  }
  const hit = owners.flatMap(([repoId]) => [...placed.get(repoId)].filter(([, fs_]) => fs_.includes(posix(path.relative(present.get(repoId).root, abs)))).map(([kid]) => [repoId, kid]))[0];
  if (!hit) { console.log(`${target}: not on the map (no present repo has it)`); process.exit(1); }
  const [repoId, kid] = hit; const k = kindById.get(kid); const file = posix(path.relative(present.get(repoId).root, abs));
  const placeOf = (kind) => [repoById.get(repoOfKind(kind)).title, ...chain(kind.area).map((id) => areaById.get(id).title).reverse(), kind.title].join(' › ');
  console.log(`${file}`);
  console.log(`  place:        ${placeOf(k)}`);
  console.log(`  kind:         ${k.id} — ${k.summary}`);
  for (const [label, f] of [['schema', 'schema'], ['index', 'index'], ['checked by', 'checked-by'], ['scenarios', 'tests'], ['installed to', 'deploy']]) console.log(`  ${(label + ':').padEnd(14)}${cell(k[f])}`);
  console.log(`  listed on:    ${pagePath(areaById.get(k.area))}`);
  const { citedBy, named, kindOf, key } = references();
  const self = key(repoId, file);
  const label = (kf) => (kf.startsWith(`${repoId}:`) ? kf.slice(repoId.length + 1) : kf);
  const direct = [...(citedBy.get(self) ?? [])].sort();
  console.log(`  linked from (direct):${direct.length ? '' : ` ${NONE}`}`);
  for (const f of direct) console.log(`    ${label(f)}`);
  const byName = [...(named.get(self) ?? [])].sort(([a], [b]) => (a < b ? -1 : 1));
  console.log(`  mentioned by name:${byName.length ? '' : ` ${NONE}`}`);
  for (const [f, n] of byName) console.log(`    ${label(f)}${n > 1 ? ` (one of ${n} nearest files with this name)` : ''}`);
  // Downstream dependants: follow a referrer only along an edge the registry declares (its kind → this kind), so the
  // chain shows real dependencies (rule → role → wrapper) rather than every mention.
  // Breadth first, so each dependant sits under the nearest file it depends on through a declared edge (4 levels at most).
  const children = new Map(); const seen = new Set([self]);
  let level = [self];
  for (let depth = 0; depth < 4 && level.length; depth++) {
    const next = [];
    for (const node of level) for (const c of [...(citedBy.get(node) ?? [])].sort()) {
      const e = reg.edges.find((x) => x.from === kindOf.get(c) && x.to === kindOf.get(node));
      if (!e || seen.has(c)) continue;
      seen.add(c); next.push(c);
      if (!children.has(node)) children.set(node, []);
      children.get(node).push([c, e]);
    }
    level = next;
  }
  const lines = [];
  const print = (node, depth) => { for (const [c, e] of children.get(node) ?? []) { lines.push(`${'  '.repeat(depth + 2)}← ${label(c)} (${e.from}: ${e.via})`); print(c, depth + 1); } };
  print(self, 0);
  console.log(`  depends on it (declared chains):${lines.length ? '' : ` ${NONE}`}`);
  for (const l of lines) console.log(l);
  process.exit(0);
}

// ---- report -------------------------------------------------------------------------------------------
const nFiles = [...present.values()].reduce((n, r) => n + r.files.length, 0);
console.log(`atlas validate: ${reg.repos.length} repos (${present.size} present), ${reg.areas.length} areas, ${reg.kinds.length} kinds, ${nFiles} files${write ? ', pages written' : ''}`);
for (const w of warns) console.log(w);
if (fails.length) { console.log(`FAIL (${fails.length})`); for (const x of fails) console.log(x); process.exit(1); }
console.log(`PASS (${warns.length} warning(s))`);
