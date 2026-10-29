#!/usr/bin/env node
// Validates Agentic SDLC v2 Store-D project files against the script-checkable
// rows in schemas/{repo-architecture,integration,constitution,task-line,blueprint,decision-record}.schema.md.
//
// Usage: node tools/validate-project.mjs <project-root> [--framework <agentic-sdlc root>] [--procedures <root>]
//                                        [--task <Tnnn> [--base <git ref>]]
//   <project-root> is required. --framework defaults to the realpath parent of this script's folder.
//   --procedures defaults to <framework>/../../procedures (repo: copilot/procedures; installed: ~/.copilot/procedures).
//   --task runs the procedure scope check for one task: every file changed since --base (default HEAD, i.e. the
//   uncommitted work), plus untracked files, must match the task's procedure allowed-paths. Run it at P6 before
//   review and before the task is marked done.
//
// Checks implemented:
// - repo-architecture/v2: front-matter, 10 ordered sections, §3/§4 fenced YAML shape,
//   stack/framework/paradigm ids, paradigm stack support, component/layer paths,
//   decisions exist, manifest-vs-stack detection, §6 integration docs.
// - integration/v1: front-matter, required sections, service row in architecture §6,
//   basic secret-pattern scan.
// - constitution-sdlc/v1: framework headings, default paradigm exists or none, integer budgets.
// - task-line/v1: task role/executor suffixes, llm continuation fields, integration and refs existence,
//   procedure: (exists, matches the task path's stack, declared inputs given; warn when a catalog exists but
//   the task states none), and with --task the procedure scope check (changed files within allowed-paths).
// - blueprint/v2: front-matter, required sections, max 3 open questions, tree-node citations.
// - decision-record/v2: record ids/fields, non-empty rejected alternatives, unique ids,
//   supersede targets, tree-node/role references.
// LLM-only checks (coverage completeness, code-vs-failure-mode behavior, human review completeness) are skipped.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const frameworkFlag = rawArgs.indexOf('--framework');
const frameworkArg = frameworkFlag >= 0 ? rawArgs.splice(frameworkFlag, 2)[1] : undefined;
const takeFlag = (n) => { const i = rawArgs.indexOf(n); return i >= 0 ? rawArgs.splice(i, 2)[1] : undefined; };
const proceduresArg = takeFlag('--procedures');
const taskArg = takeFlag('--task');
const baseArg = takeFlag('--base') ?? 'HEAD';
if (!rawArgs[0]) {
  console.error('Usage: node tools/validate-project.mjs <project-root> [--framework <agentic-sdlc root>]');
  process.exit(1);
}
const projectRoot = fs.realpathSync(path.resolve(rawArgs[0]));
const frameworkRoot = fs.realpathSync(path.resolve(frameworkArg ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const agentHome = process.env.AGENT_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.copilot');
const proceduresRoot = path.resolve(proceduresArg ?? path.join(frameworkRoot, '..', '..', 'procedures'));

const failures = [];
const warnings = [];
const fail = (code, msg) => failures.push(`${code}  ${msg}`);
const warn = (code, msg) => warnings.push(`${code}  ${msg}`);
const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const relProject = (p) => path.relative(projectRoot, p).split(path.sep).join('/');
const relFramework = (p) => path.relative(frameworkRoot, p).split(path.sep).join('/');
const posix = (p) => p.split(path.sep).join('/');

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.git' && e.name !== 'dist') walk(p, out);
    } else out.push(p);
  }
  return out;
}

function frontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^['"](.*)['"]$/, '$1');
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"](.*)['"]$/, '$1')).filter(Boolean);
    fm[kv[1]] = v;
  }
  return fm;
}

function section(text, name, level = 2) {
  const lines = text.split(/\r?\n/);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = lines.findIndex((l) => new RegExp(`^${'#'.repeat(level)} ${escaped}\\s*$`).test(l));
  if (start < 0) return null;
  const out = [];
  for (const l of lines.slice(start + 1)) {
    const h = l.match(/^(#{1,6}) /);
    if (h && h[1].length <= level) break;
    out.push(l);
  }
  return out.join('\n');
}

function sectionByPrefix(text, prefix, level = 2) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`${'#'.repeat(level)} ${prefix}`));
  if (start < 0) return null;
  const out = [];
  for (const l of lines.slice(start + 1)) {
    const h = l.match(/^(#{1,6}) /);
    if (h && h[1].length <= level) break;
    out.push(l);
  }
  return out.join('\n');
}

function headings(text, level = 2) {
  return [...text.matchAll(new RegExp(`^${'#'.repeat(level)} (.+?)\\s*$`, 'gm'))].map((m) => m[1].trim());
}

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function tables(text, firstCol) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) continue;
    const head = cells(lines[i]);
    if (head[0] !== firstCol || !/^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) continue;
    const rows = [];
    let j = i + 2;
    for (; j < lines.length && lines[j].trim().startsWith('|'); j++) {
      const c = cells(lines[j]);
      if (c.every((v) => !v)) continue;
      rows.push(Object.fromEntries(head.map((h, k) => [h, c[k] ?? ''])));
    }
    out.push(rows);
    i = j;
  }
  return out;
}

const stripTicks = (s) => String(s ?? '').replace(/`/g, '').trim();
function splitCsv(s) {
  const out = [];
  let cur = '';
  let depth = 0;
  let quote = null;
  for (const ch of String(s ?? '')) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function parseValue(v) {
  let s = String(v ?? '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
  if (s.startsWith('[') && s.endsWith(']')) return splitCsv(s.slice(1, -1)).map(parseValue);
  return s;
}
function parseFlowMap(s) {
  const inner = s.trim().replace(/^\{/, '').replace(/\}$/, '');
  const obj = {};
  for (const part of splitCsv(inner)) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    obj[part.slice(0, idx).trim()] = parseValue(part.slice(idx + 1));
  }
  return obj;
}
function parseYamlListBlock(yaml, key) {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `${key}:`);
  if (start < 0) return null;
  const rows = [];
  let cur = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) break;
    const item = line.match(/^\s*-\s*(.*)$/);
    if (item) {
      if (cur) rows.push(cur);
      let rest = item[1].trim();
      // Formatters (e.g. Prettier) wrap a long flow map over several lines; join until the braces balance.
      const depth = (s) => (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
      while (rest.startsWith('{') && depth(rest) > 0 && i + 1 < lines.length) rest += ` ${lines[++i].trim()}`;
      cur = rest.startsWith('{') ? parseFlowMap(rest) : {};
      if (rest && !rest.startsWith('{')) {
        const idx = rest.indexOf(':');
        if (idx >= 0) cur[rest.slice(0, idx).trim()] = parseValue(rest.slice(idx + 1));
      }
      continue;
    }
    const kv = line.match(/^\s+([\w.-]+):\s*(.*)$/);
    if (kv && cur) cur[kv[1]] = parseValue(kv[2]);
  }
  if (cur) rows.push(cur);
  return rows;
}
// A stack's idioms.md declares a ```lint-baseline block: `config:` candidate files (first found wins)
// and `require:` strings that must appear in it. A project missing them fails, so the rules that
// keep comments and imports consistent cannot be silently left out of a repo.
function checkLintBaseline(stack, comps) {
  const idioms = path.join(frameworkRoot, 'stacks', stack, 'idioms.md');
  if (!exists(idioms)) return;
  const block = fs.readFileSync(idioms, 'utf8').match(/```lint-baseline\s*\r?\n([\s\S]*?)\r?\n```/);
  if (!block) return;
  const configs = (block[1].match(/^config:\s*(.+)$/m)?.[1] ?? '').split('|').map((s) => s.trim()).filter(Boolean);
  // Items under `require:` always apply; items under `require-if: <file> <key>` apply when that file has that key.
  const groups = [];
  for (const line of block[1].split(/\r?\n/)) {
    const cond = line.match(/^require-if:\s*(\S+)\s+(\S+)\s*$/);
    if (/^require:\s*$/.test(line)) groups.push({ when: null, items: [] });
    else if (cond) groups.push({ when: { file: cond[1], key: cond[2] }, items: [] });
    else if (groups.length && /^\s+-\s+/.test(line)) groups.at(-1).items.push(line.replace(/^\s+-\s+/, '').trim());
  }
  for (const c of comps) {
    const root = path.join(projectRoot, ...String(c.path || '.').replace(/\/$/, '').split('/'));
    const found = configs.map((f) => path.join(root, f)).find(exists);
    const label = `component ${c.name || '<unnamed>'} (stack ${stack})`;
    if (!found) { fail('LINT', `${label}: none of ${configs.join(', ')} found; stacks/${stack}/idioms.md lint-baseline requires one`); continue; }
    const cfg = fs.readFileSync(found, 'utf8');
    const applies = (w) => {
      if (!w) return true;
      const f = path.join(root, w.file);
      return exists(f) && new RegExp(`"${w.key}"\\s*:`).test(fs.readFileSync(f, 'utf8'));
    };
    for (const g of groups.filter((g) => applies(g.when))) {
      const why = g.when ? `, because ${g.when.file} has "${g.when.key}"` : '';
      for (const r of g.items) if (!cfg.includes(r)) fail('LINT', `${label}: ${path.basename(found)} lacks "${r}" (stacks/${stack}/idioms.md lint-baseline${why})`);
    }
  }
}

function fencedYaml(sec) {
  const m = String(sec ?? '').match(/```yaml\s*\r?\n([\s\S]*?)\r?\n```/);
  return m ? m[1] : null;
}

function yamlListFromConventions(conv, key) {
  const m = conv.match(new RegExp(`^${key}:\\s*\\r?\\n((?:[ \\t]+- \\{.*\\}[ \\t]*\\r?\\n?)+)`, 'm'));
  if (!m) return [];
  return m[1].split(/\r?\n/).filter((l) => l.trim().startsWith('- {')).map((l) => parseFlowMap(l.trim().replace(/^-\s*/, '')));
}

// Framework index ------------------------------------------------------------
const conventionsPath = path.join(frameworkRoot, 'conventions.md');
if (!exists(conventionsPath)) { console.error(`conventions.md not found at ${conventionsPath}`); process.exit(1); }
const conventions = read(conventionsPath);
const roles = yamlListFromConventions(conventions, 'roles');
const roleTags = new Set(roles.map((r) => String(r.tag || '').replace(/^\[/, '').replace(/\]$/, '')).filter((t) => t && t !== '—'));
const roleIds = new Set(roles.map((r) => r.id).filter(Boolean));

const treeNodes = new Set();
for (const f of walk(path.join(frameworkRoot, 'trees')).filter((p) => p.endsWith('.tree.md'))) {
  for (const m of read(f).matchAll(/^### ([A-Z]{2,5}-Q\d+[a-z]?)\b/gm)) treeNodes.add(m[1]);
}
function checkTreeCitations(fileLabel, text) {
  for (const m of text.matchAll(/\b([A-Z]{2,5}-Q\d+[a-z]?)\b/g)) {
    if (!treeNodes.has(m[1])) fail('TREE', `${fileLabel}: tree node ${m[1]} is not defined in framework trees`);
  }
}

const stacks = new Map();
for (const stackDir of fs.readdirSync(path.join(frameworkRoot, 'stacks'), { withFileTypes: true }).filter((e) => e.isDirectory())) {
  const idx = path.join(frameworkRoot, 'stacks', stackDir.name, 'index.md');
  if (!exists(idx)) continue;
  const fm = frontMatter(read(idx)) || {};
  stacks.set(stackDir.name, { frameworks: new Set(fm.frameworks || []), paradigms: new Set(fm.paradigms || []), detectBy: fm['detect-by'] || [] });
}
const paradigms = new Map();
for (const p of walk(path.join(frameworkRoot, 'paradigms')).filter((f) => f.endsWith('.md'))) {
  const fm = frontMatter(read(p)) || {};
  if (fm.id) paradigms.set(`${fm.id}@${fm.version}`, { id: fm.id, version: String(fm.version), supports: new Set(fm.supports || []), file: relFramework(p) });
}

const ruleIds = new Set();
for (const p of walk(frameworkRoot).filter((f) => /[\\/](foundations|stacks|paradigms)[\\/].+\.md$/.test(f))) {
  // Every rule table counts, not only `## Rules`: stack idioms keep theirs under
  // "Language conventions" and "Runtime & performance".
  for (const row of tables(read(p), 'Id').flat()) if (row.Id) ruleIds.add(stripTicks(row.Id));
}
function checkRuleCitations(fileLabel, text) {
  const candidates = new Set();
  for (const m of text.matchAll(/\b(PDM-[a-z0-9-]+-R\d+)\b/g)) candidates.add(m[1]);
  for (const m of text.matchAll(/(?<![\w-])([A-Z]{2,6}-\d+)\b/g)) {
    if (!['DR', 'FR', 'AC', 'US'].includes(m[1].split('-')[0])) candidates.add(m[1]);
  }
  for (const id of candidates) if (!ruleIds.has(id)) warn('RULE', `${fileLabel}: cited rule id ${id} was not found in foundations/stacks/paradigms`);
}

// Decision records -----------------------------------------------------------
function parseDecisionRecords(researchPath) {
  const records = new Map();
  if (!exists(researchPath)) return records;
  const text = read(researchPath);
  const lines = text.split(/\r?\n/);
  let current = null;
  let body = [];
  const close = () => {
    if (!current) return;
    const b = body.join('\n');
    if (records.has(current.id)) fail('DR', `${relProject(researchPath)}: duplicate decision id ${current.id}`);
    records.set(current.id, { ...current, body: b });
  };
  for (const line of lines) {
    const h = line.match(/^##\s+((?:DR-\d{3})|(?:SDR-\d{3})|(?:PDM-[a-z0-9-]+(?:-\d+)?)):\s*(.+)$/);
    if (h) { close(); current = { id: h[1], topic: h[2] }; body = []; continue; }
    if (/^##\s+/.test(line)) { close(); current = null; body = []; continue; }
    if (current) body.push(line);
  }
  close();
  return records;
}
const allDecisionRecords = new Map();
for (const researchPath of walk(path.join(projectRoot, 'specs')).filter((p) => p.endsWith(`${path.sep}research.md`))) {
  const records = parseDecisionRecords(researchPath);
  for (const [id, rec] of records) allDecisionRecords.set(id, { ...rec, path: researchPath });
  const text = read(researchPath);
  checkTreeCitations(relProject(researchPath), text);
  checkRuleCitations(relProject(researchPath), text);
}
function decisionExists(id) { return allDecisionRecords.has(id); }

// Architecture ---------------------------------------------------------------
const architecturePath = path.join(projectRoot, 'docs', 'architecture.md');
let components = [];
let layers = [];
const archServices = new Set();
const archDecisionRefs = new Set();
if (!exists(architecturePath)) {
  fail('ARCH', 'docs/architecture.md is missing; run the Agentic SDLC bootstrap procedure to create repo architecture state');
} else {
  const text = read(architecturePath);
  const fm = frontMatter(text);
  if (!fm) fail('ARCH', 'docs/architecture.md: missing front-matter');
  else {
    if (fm.schema !== 'repo-architecture/v2') fail('ARCH', `docs/architecture.md: schema must be repo-architecture/v2 (got ${fm.schema ?? 'none'})`);
    if (!fm['last-updated']) fail('ARCH', 'docs/architecture.md: last-updated missing');
    if (!fm['updated-by']) fail('ARCH', 'docs/architecture.md: updated-by missing');
  }
  const required = ['1. Overview', '2. System context', '3. Components', '4. Layers & dependency rules', '5. Data', '6. External dependencies', '7. Cross-cutting concerns', '8. Key decisions', '9. Verification status', '10. Known gaps / out of scope'];
  const hs = headings(text);
  const idx = required.map((h) => hs.indexOf(h));
  required.forEach((h, i) => { if (idx[i] < 0) fail('ARCH', `docs/architecture.md: section "## ${h}" missing`); });
  if (idx.every((i) => i >= 0) && idx.some((v, i) => i > 0 && v < idx[i - 1])) fail('ARCH', 'docs/architecture.md: sections are out of order');

  const compYaml = fencedYaml(section(text, '3. Components'));
  if (!compYaml) fail('ARCH', 'docs/architecture.md §3: missing fenced yaml block');
  else {
    components = parseYamlListBlock(compYaml, 'components') ?? [];
    if (!components.length) fail('ARCH', 'docs/architecture.md §3: components list is empty or unparsable');
    const seenNames = new Set();
    const seenPaths = new Set();
    for (const c of components) {
      const label = `docs/architecture.md §3 component ${c.name || '<unnamed>'}`;
      for (const k of ['name', 'path', 'kind']) if (!c[k]) fail('ARCH', `${label}: missing ${k}`);
      if (c.name && seenNames.has(c.name)) fail('ARCH', `${label}: duplicate component name`);
      if (c.name) seenNames.add(c.name);
      if (c.path && seenPaths.has(c.path)) fail('ARCH', `${label}: duplicate component path ${c.path}`);
      if (c.path) seenPaths.add(c.path);
      if (c.kind && !['service', 'library', 'script', 'datastore'].includes(c.kind)) fail('ARCH', `${label}: invalid kind ${c.kind}`);
      if (c.path && !exists(path.join(projectRoot, ...String(c.path).replace(/\/$/, '').split('/')))) fail('ARCH', `${label}: path ${c.path} does not exist`);
      const hasCode = ['service', 'library', 'script'].includes(c.kind);
      if (hasCode && !c.stack) fail('ARCH', `${label}: code component missing stack`);
      if (c.stack && !stacks.has(c.stack)) fail('ARCH', `${label}: stack ${c.stack} is not defined under framework stacks/`);
      if (c.framework && c.stack && stacks.has(c.stack) && !stacks.get(c.stack).frameworks.has(c.framework)) fail('ARCH', `${label}: framework ${c.framework} is not listed by stack ${c.stack}`);
      if (c.paradigm) {
        const pdm = paradigms.get(c.paradigm);
        if (!pdm) fail('ARCH', `${label}: paradigm ${c.paradigm} is not defined as id@version`);
        else if (c.stack && !pdm.supports.has(c.stack)) fail('ARCH', `${label}: paradigm ${c.paradigm} does not support stack ${c.stack}`);
      }
      const decisions = Array.isArray(c.decisions) ? c.decisions : (c.decisions ? [c.decisions] : []);
      if ((c.stack || c.paradigm) && !decisions.length) fail('ARCH', `${label}: decisions are required when stack or paradigm is set`);
      for (const id of decisions) { archDecisionRefs.add(id); if (!decisionExists(id)) fail('ARCH', `${label}: decision ${id} not found in specs/*/research.md`); }
    }
    for (const stack of new Set(components.map((c) => c.stack).filter((s) => s && stacks.has(s)))) checkLintBaseline(stack, components.filter((c) => c.stack === stack));
    if (exists(path.join(projectRoot, 'src'))) {
      // `./` (the repo root) covers src/ just as `src/` does.
      const srcCovered = components.some((c) => ['src', '.'].includes(String(c.path || '').replace(/\/$/, '')) && ['service', 'library'].includes(c.kind));
      const childDirs = fs.readdirSync(path.join(projectRoot, 'src'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `src/${e.name}`);
      for (const d of childDirs) {
        const covered = srcCovered || components.some((c) => d === String(c.path || '').replace(/\/$/, '') || d.startsWith(String(c.path || '').replace(/\/$/, '') + '/'));
        if (!covered) fail('ARCH', `docs/architecture.md §3: source directory ${d}/ is not covered by a component path`);
      }
    }
  }

  const layerYaml = fencedYaml(section(text, '4. Layers & dependency rules'));
  if (!layerYaml) fail('ARCH', 'docs/architecture.md §4: missing fenced yaml block');
  else {
    layers = parseYamlListBlock(layerYaml, 'layers') ?? [];
    if (!layers.length) fail('ARCH', 'docs/architecture.md §4: layers list is empty or unparsable');
    const names = new Set(layers.map((l) => l.name).filter(Boolean));
    // Feature-first (MOD-9): an optional modules list; layer paths are then relative to each module.
    const modules = parseYamlListBlock(layerYaml, 'modules') ?? [];
    const mnames = new Set(modules.map((m) => m.name).filter(Boolean));
    const at = (...parts) => path.join(projectRoot, ...parts.flatMap((p) => String(p).replace(/\/$/, '').split('/')).filter(Boolean));
    for (const m of modules) {
      const label = `docs/architecture.md §4 module ${m.name || '<unnamed>'}`;
      for (const k of ['name', 'path', 'may-depend-on', 'public']) if (!(k in m)) fail('ARCH', `${label}: missing ${k}`);
      if (m.path && !exists(at(m.path))) fail('ARCH', `${label}: path ${m.path} does not exist`);
      for (const dep of Array.isArray(m['may-depend-on']) ? m['may-depend-on'] : []) if (!mnames.has(dep)) fail('ARCH', `${label}: may-depend-on target ${dep} is not a module`);
    }
    for (const l of layers) {
      const label = `docs/architecture.md §4 layer ${l.name || '<unnamed>'}`;
      for (const k of ['name', 'path', 'may-depend-on']) if (!(k in l)) fail('ARCH', `${label}: missing ${k}`);
      if (l.path && !modules.length && !exists(at(l.path))) fail('ARCH', `${label}: path ${l.path} does not exist`);
      for (const m of modules) if (l.path && m.path && !exists(at(m.path, l.path))) fail('ARCH', `${label}: path ${m.path}${l.path} does not exist (every module has every layer; an empty one keeps a .gitkeep)`);
      const deps = Array.isArray(l['may-depend-on']) ? l['may-depend-on'] : [];
      for (const dep of deps) if (!names.has(dep)) fail('ARCH', `${label}: may-depend-on target ${dep} is not a layer`);
      if (l.paradigm && !paradigms.has(l.paradigm)) fail('ARCH', `${label}: paradigm ${l.paradigm} is not defined`);
    }
  }

  if (exists(path.join(projectRoot, 'package.json')) || exists(path.join(projectRoot, 'tsconfig.json')) || exists(path.join(projectRoot, 'pnpm-lock.yaml'))) {
    if (!components.some((c) => c.stack === 'typescript-node')) fail('ARCH', 'Manifest detection found TypeScript/Node files, but no component declares stack: typescript-node');
  }
  for (const row of tables(section(text, '6. External dependencies') ?? '', 'Dependency').flat()) {
    const dep = stripTicks(row.Dependency);
    const doc = stripTicks(row.Doc);
    const kind = stripTicks(row.Kind).toLowerCase();
    if (dep && dep !== '<name>') archServices.add(dep);
    if (kind && !['none', '—', '-', 'n/a'].includes(kind) && doc && !/^_?none/i.test(doc)) {
      const docPath = path.join(projectRoot, ...doc.split('/'));
      if (!exists(docPath)) fail('ARCH', `docs/architecture.md §6: integration doc ${doc} for ${dep} does not exist`);
    }
  }
  for (const row of tables(section(text, '8. Key decisions') ?? '', 'Id').flat()) {
    const id = stripTicks(row.Id);
    if (id && id !== '<id>') { archDecisionRefs.add(id); if (!decisionExists(id)) fail('ARCH', `docs/architecture.md §8: decision ${id} not found in specs/*/research.md`); }
  }
  checkTreeCitations('docs/architecture.md', text);
  checkRuleCitations('docs/architecture.md', text);
}

// Integrations ---------------------------------------------------------------
for (const p of walk(path.join(projectRoot, 'docs', 'integrations')).filter((f) => f.endsWith('.md'))) {
  const text = read(p);
  const fm = frontMatter(text);
  const label = relProject(p);
  if (!fm) fail('INT', `${label}: missing front-matter`);
  else {
    if (fm.schema !== 'integration/v1') fail('INT', `${label}: schema must be integration/v1`);
    if (!fm.service) fail('INT', `${label}: service missing`);
    else if (!archServices.has(fm.service)) fail('INT', `${label}: service ${fm.service} has no row in docs/architecture.md §6`);
  }
  for (const h of ['Purpose', 'Endpoints', 'Auth', 'Local setup', 'Limits', 'Failure modes', 'Contract', 'Owner', 'References', 'Related']) {
    if (section(text, h) === null) fail('INT', `${label}: section "## ${h}" missing`);
  }
  const secretPatterns = [/(?:api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[A-Za-z0-9_\-.]{20,}/i, /\b(?:ghp|github_pat|sk)-[A-Za-z0-9_\-]{20,}\b/];
  for (const re of secretPatterns) if (re.test(text)) fail('SECRET', `${label}: possible secret value found; integration docs may list env var names only`);
}

// Constitution ---------------------------------------------------------------
const constitutionPath = path.join(projectRoot, '.specify', 'memory', 'constitution.md');
if (exists(constitutionPath)) {
  const text = read(constitutionPath);
  for (const h of ['Agentic SDLC: defaults', 'Agentic SDLC: style deviations', 'Agentic SDLC: budgets']) {
    if (section(text, h) === null) fail('CONST', `.specify/memory/constitution.md: section "## ${h}" missing`);
  }
  const defaults = section(text, 'Agentic SDLC: defaults') ?? '';
  const pdm = defaults.match(/\*\*Default paradigm:\*\*\s*([^\r\n|]+)/);
  if (!pdm) fail('CONST', '.specify/memory/constitution.md: Default paradigm line missing');
  else {
    const value = pdm[1].trim();
    if (value !== 'none' && !paradigms.has(value)) fail('CONST', `.specify/memory/constitution.md: default paradigm ${value} is not defined`);
  }
  const budgets = tables(section(text, 'Agentic SDLC: budgets') ?? '', 'Loop').flat();
  if (!budgets.length && !/^>\s*_Framework defaults apply\._/m.test(section(text, 'Agentic SDLC: budgets') ?? '')) fail('CONST', '.specify/memory/constitution.md: budgets table missing');
  for (const row of budgets) if (!/^\d+$/.test(stripTicks(row.Budget))) fail('CONST', `.specify/memory/constitution.md: budget for "${row.Loop}" is not an integer`);
  checkTreeCitations('.specify/memory/constitution.md', text);
  checkRuleCitations('.specify/memory/constitution.md', text);
}

// Blueprint -----------------------------------------------------------------
for (const p of walk(path.join(projectRoot, 'specs')).filter((f) => f.endsWith(`${path.sep}blueprint.md`))) {
  const text = read(p);
  const fm = frontMatter(text);
  const label = relProject(p);
  if (!fm) fail('BP', `${label}: missing front-matter`);
  else {
    if (fm.schema !== 'blueprint/v2') fail('BP', `${label}: schema must be blueprint/v2`);
    for (const k of ['mission_type', 'affected', 'based_on', 'approved_at']) if (!(k in fm)) fail('BP', `${label}: front-matter ${k} missing`);
  }
  for (const h of ['Mission', 'Proposals', 'System impact', 'Assumptions', 'Open questions']) if (section(text, h) === null) fail('BP', `${label}: section "## ${h}" missing`);
  const oq = section(text, 'Open questions') ?? '';
  const count = (oq.match(/^\d+\.\s+/gm) || []).length;
  if (count > 3) fail('BP', `${label}: Open questions has ${count}; max is 3`);
  checkTreeCitations(label, text);
  checkRuleCitations(label, text);
}

// Decision record field validation ------------------------------------------
for (const [id, rec] of allDecisionRecords) {
  const label = `${relProject(rec.path)} ${id}`;
  const body = rec.body;
  const fields = ['Tree path', 'Criteria', 'Options considered', 'Chosen', 'Rejected', 'Confidence', 'Supersedes', 'Decided by'];
  for (const f of fields) if (!new RegExp(`^- \\*\\*${f}:\\*\\*`, 'm').test(body)) fail('DR', `${label}: field "${f}" missing or not bold`);
  const rejected = body.match(/^- \*\*Rejected:\*\*\s*(.+)$/m)?.[1]?.trim() ?? '';
  if (!rejected || /^n\/?a\b|^none\b|^—$|^-$|^no alternative/i.test(rejected)) fail('DR', `${label}: Rejected must name at least one rejected alternative`);
  const confidence = body.match(/^- \*\*Confidence:\*\*\s*(.+)$/m)?.[1]?.trim();
  if (confidence && !/^(high|medium|low)\b/.test(confidence)) fail('DR', `${label}: Confidence must be high, medium, or low`);
  const supersedes = body.match(/^- \*\*Supersedes:\*\*\s*(.+)$/m)?.[1]?.trim();
  if (supersedes && supersedes !== 'none' && !decisionExists(supersedes)) fail('DR', `${label}: Supersedes target ${supersedes} does not exist`);
  const decided = body.match(/^- \*\*Decided by:\*\*\s*([^·\n]+)/m)?.[1]?.trim();
  if (decided && decided !== 'human' && !roleIds.has(decided)) fail('DR', `${label}: Decided by ${decided} is not a role id or human`);
}

// Procedures (task-line procedure:) ------------------------------------------
// Front-matter of a stack procedure: stack, inputs (inline list) and allowed-paths (block list of globs).
function procedureMeta(file) {
  const m = read(file).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const meta = { stack: undefined, inputs: [], optional: new Set(), allowed: [] };
  if (!m) return meta;
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      const v = kv[2].trim();
      if (key === 'stack') meta.stack = v;
      if (key === 'inputs') {
        // A trailing ? marks an optional input, e.g. module? (empty for a layer-first repo).
        const raw = v.replace(/^\[|\]$/g, '').split(',').map((x) => x.trim()).filter(Boolean);
        meta.inputs = raw.map((x) => x.replace(/\?$/, ''));
        for (const x of raw) if (x.endsWith('?')) meta.optional.add(x.slice(0, -1));
      }
      continue;
    }
    const item = line.match(/^\s+-\s+(.+?)\s*$/);
    if (item && key === 'allowed-paths') meta.allowed.push(item[1].replace(/^['"](.*)['"]$/, '$1'));
  }
  return meta;
}
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*'; i += glob[i + 2] === '/' ? 2 : 1; }
    else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
const normDir = (p) => { const d = String(p || '').replace(/^\.\/?/, '').replace(/\/$/, ''); return d === '.' ? '' : d; };
function componentFor(taskPath) {
  const t = normDir(taskPath);
  let best = null;
  for (const c of components) {
    const d = normDir(c.path);
    if ((d === '' || t === d || t.startsWith(`${d}/`)) && (!best || d.length > normDir(best.path).length)) best = c;
  }
  return best;
}
const taskProcedures = new Map(); // Tnnn -> { label, line, procedure, meta, component }

// Tasks ---------------------------------------------------------------------
function resolveRef(ref) {
  const r = stripTicks(ref);
  if (!r || r === 'none') return null;
  if (r.startsWith('{{AGENT_HOME}}/')) return path.join(agentHome, ...r.slice('{{AGENT_HOME}}/'.length).split('/'));
  if (/^[a-zA-Z]+:\/\//.test(r)) return null;
  return path.join(projectRoot, ...r.split('/'));
}
for (const p of walk(path.join(projectRoot, 'specs')).filter((f) => f.endsWith(`${path.sep}tasks.md`))) {
  const text = read(p);
  const lines = text.split(/\r?\n/);
  const label = relProject(p);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^- \[[ xX]\]\s+T\d+/.test(line)) continue;
    const tags = [...line.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
    const dept = [...tags].reverse().find((t) => roleTags.has(t));
    const exec = [...tags].reverse().find((t) => ['llm', 'script'].includes(t));
    if (!dept) fail('TASK', `${label}:${i + 1}: missing department tag from conventions.md roles`);
    if (!exec) fail('TASK', `${label}:${i + 1}: missing executor tag [llm] or [script]`);
    const next = lines[i + 1] ?? '';
    if (exec === 'llm') {
      // Continuation line: "touches: … · refs: … · procedure: … · hot-path: …", read field by field, so an empty or
      // wrong value is reported as itself instead of being swallowed by the field before it.
      const fields = new Map(/^\s+[\w-]+:/.test(next) ? next.trim().split('·').map((f) => f.trim().match(/^([\w-]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]) : []);
      if (!fields.has('touches') || !fields.has('refs')) { fail('TASK', `${label}:${i + 1}: [llm] task missing continuation line with touches/refs`); continue; }
      const touches = fields.get('touches').split(',').map((s) => s.trim()).filter(Boolean);
      const refs = fields.get('refs').split(',').map((s) => s.trim()).filter(Boolean);
      if (!touches.length) fail('TASK', `${label}:${i + 2}: touches must be explicit (none or integration:<svc>)`);
      for (const t of touches) if (t !== 'none') {
        const svc = t.match(/^integration:([A-Za-z0-9_-]+)$/)?.[1];
        if (!svc) fail('TASK', `${label}:${i + 2}: invalid touches entry ${t}`);
        else if (!archServices.has(svc)) fail('TASK', `${label}:${i + 2}: integration ${svc} has no architecture §6 row`);
      }
      if (!refs.length) fail('TASK', `${label}:${i + 2}: refs must be explicit (none or paths)`);
      for (const r of refs) if (r !== 'none') {
        const rp = resolveRef(r);
        if (rp && !exists(rp)) fail('TASK', `${label}:${i + 2}: refs path ${r} does not exist`);
      }
      const hot = fields.get('hot-path');
      if (hot && !['yes', 'no'].includes(hot)) fail('TASK', `${label}:${i + 2}: hot-path must be yes or no`);
      // procedure: (task-line.schema.md) — a bounded scope chosen at P5
      const id = line.match(/^- \[[ xX]\]\s+(T\d+)/)[1];
      const taskPath = line.match(/\(([^()]+)\)\s*(?:\[|$)/)?.[1]?.trim();
      const comp = taskPath ? componentFor(taskPath) : null;
      const proc = fields.get('procedure') || undefined;
      const inputsLine = /^\s+inputs:\s*(.*)$/.exec(lines[i + 2] ?? '');
      if (!proc) {
        if (comp?.stack && exists(path.join(proceduresRoot, comp.stack, 'index.md'))) warn('TASK', `${label}:${i + 2}: stack ${comp.stack} has a procedure catalog; state procedure: none or procedure: ${comp.stack}/<slug>`);
      } else if (proc !== 'none') {
        const pm = proc.match(/^([a-z0-9-]+)\/([a-z0-9-]+)$/);
        const file = pm ? path.join(proceduresRoot, pm[1], `${pm[2]}.procedure.md`) : null;
        if (!pm) fail('TASK', `${label}:${i + 2}: procedure must be none or <stack>/<slug>, got ${proc}`);
        else if (!exists(file)) fail('TASK', `${label}:${i + 2}: procedure ${proc} not found at ${file}`);
        else {
          const meta = procedureMeta(file);
          if (comp?.stack && comp.stack !== pm[1]) fail('TASK', `${label}:${i + 2}: procedure ${proc} is for stack ${pm[1]}, but the task path's component ${comp.name} is ${comp.stack}`);
          if (!comp) fail('TASK', `${label}:${i + 1}: task with a procedure needs a path in (…) inside a component of architecture §3`);
          const given = new Map((inputsLine?.[1] ?? '').split(';').map((kv) => kv.split('=')).filter((a) => a.length >= 2).map(([k, ...v]) => [k.trim(), v.join('=').trim()]));
          for (const inp of meta.inputs) if (!meta.optional.has(inp) && !given.get(inp)) fail('TASK', `${label}:${i + 3}: procedure ${proc} needs input ${inp} (inputs: ${inp}=<value>; …)`);
          for (const k of given.keys()) if (!meta.inputs.includes(k)) fail('TASK', `${label}:${i + 3}: input ${k} is not declared by procedure ${proc}`);
          taskProcedures.set(id, { label, line: i + 1, procedure: proc, meta, component: comp, given });
        }
      } else taskProcedures.set(id, { label, line: i + 1, procedure: 'none' });
      if (inputsLine && (!proc || proc === 'none')) fail('TASK', `${label}:${i + 3}: inputs: given but the task has no procedure`);
    }
  }
  checkTreeCitations(label, text);
  checkRuleCitations(label, text);
  for (const m of text.matchAll(/\b((?:DR-\d{3})|(?:PDM-[a-z0-9-]+(?:-\d+)?))\b/g)) {
    if (!decisionExists(m[1])) fail('TASK', `${label}: decision reference ${m[1]} does not exist in research.md`);
  }
}

for (const id of archDecisionRefs) if (!decisionExists(id)) fail('ARCH', `decision ${id} referenced by architecture does not exist`);

// Procedure scope check (--task) ----------------------------------------------
if (taskArg) {
  const t = taskProcedures.get(taskArg);
  if (!t) fail('SCOPE', `--task ${taskArg}: no such [llm] task with a procedure: field in specs/*/tasks.md`);
  else if (t.procedure === 'none') warnings.push(`SCOPE  ${taskArg}: procedure: none, so there is no scope to check`);
  else {
    // git's own messages are captured, not passed through: their wording differs between git versions.
    const git = (...a) => execFileSync('git', ['-C', projectRoot, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n').filter(Boolean);
    let changed = [];
    try { changed = [...new Set([...git('diff', '--relative', '--name-only', baseArg), ...git('ls-files', '--others', '--exclude-standard')])]; }
    catch (e) { fail('SCOPE', `--task ${taskArg}: git failed (${String(e.stderr ?? '').trim().split('\n')[0] || String(e.message).split('\n')[0]})`); }
    const compDir = normDir(t.component.path);
    // {input} placeholders take the task's input value; an empty optional input collapses its path segment.
    const fill = (g) => g.replace(/\{([^}]+)\}/g, (_, k) => t.given.get(k) ?? '').replace(/\/{2,}/g, '/').replace(/^\//, '');
    const globs = t.meta.allowed.map(fill);
    const allowed = globs.map(globToRegExp);
    for (const f of changed) {
      const inComp = compDir === '' ? f : f.startsWith(`${compDir}/`) ? f.slice(compDir.length + 1) : null;
      if (inComp === null || !allowed.some((re) => re.test(inComp))) fail('SCOPE', `${taskArg} (${t.procedure}): ${f} is outside the procedure's allowed-paths (${globs.join(', ')})`);
    }
    if (!failures.some((x) => x.startsWith('SCOPE'))) warnings.push(`SCOPE  ${taskArg}: ${changed.length} changed file(s), all inside ${t.procedure} allowed-paths`);
  }
}

if (failures.length) {
  console.log(`FAIL (${failures.length})`);
  for (const f of failures) console.log(`  ${f}`);
  if (warnings.length) {
    console.log(`WARN (${warnings.length})`);
    for (const w of warnings) console.log(`  ${w}`);
  }
  process.exit(1);
}
console.log(`PASS (${warnings.length} warning(s))`);
for (const w of warnings) console.log(`  ${w}`);
