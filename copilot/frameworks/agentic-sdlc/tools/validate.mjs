#!/usr/bin/env node
// Validates the agentic-sdlc v2 framework files against the "Checks" tables
// of schemas/*.schema.md (conventions.md §12). No dependencies.
// Roles, profile dimensions, rule prefixes and tree prefixes are read from the
// docs themselves (conventions.md §1/§4, front-matter) — never hardcoded here.
//
// Usage: node tools/validate.mjs [frameworkRoot] [--repo <agent-config repo root>] [--upstream]
//   --upstream also asks GitHub for the latest tag of every stack reference repo (stacks/<id>/reference.md)
//   and warns when it differs from the pinned tag (network; uses GITHUB_TOKEN when set, and GITHUB_API_URL when set,
//   as GitHub Actions and GitHub Enterprise do; default https://api.github.com).
//   frameworkRoot defaults to this script's parent dir. The repo root (for
//   wrappers and skills) defaults to <frameworkRoot>/../../.. when it holds
//   skills/; otherwise wrapper/skill checks are skipped with a notice.
// Exit code: 0 = no failures (warnings allowed), 1 = at least one failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const repoFlag = args.indexOf('--repo');
const repoArg = repoFlag >= 0 ? args.splice(repoFlag, 2)[1] : undefined;
const upstream = args.includes('--upstream'); if (upstream) args.splice(args.indexOf('--upstream'), 1);
const refPins = []; // [stack, repo, pinned] for --upstream
const root = fs.realpathSync(path.resolve(args[0] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const guessRepo = path.resolve(root, '..', '..', '..');
const repo = repoArg ? path.resolve(repoArg) : (fs.existsSync(path.join(guessRepo, 'skills')) ? guessRepo : null);
const knowledgeRoot = repo ? path.join(repo, 'copilot', 'knowledge') : path.resolve(root, '..', '..', 'knowledge');

// The only fixed lists: values defined by schemas/_system.md §1.4 and stack.schema.md.
const ENFORCED_BY = ['lint', 'typecheck', 'test', 'script', 'llm'];
const SLOTS = ['language_version', 'package_manager', 'project_layout', 'style_guide', 'cmd.install', 'cmd.format', 'cmd.lint',
  'cmd.typecheck', 'cmd.test_unit', 'cmd.test_integration', 'cmd.build', 'cmd.audit', 'idiom.errors', 'idiom.concurrency',
  'idiom.di', 'idiom.config', 'idiom.logging', 'tools'];
const SUBJECTS = ['code', 'design', 'quality', 'delivery', 'review'];
const PARADIGM_SECTIONS = ['Core idea', 'Use when', 'Avoid when', 'Modeling', 'State', 'Composition', 'Effects', 'Errors shape',
  'Testing shape', 'Rules', 'Escape hatches', 'Changelog', 'References', 'Related'];
const IDIOM_SECTIONS = ['idiom.errors', 'idiom.concurrency', 'idiom.di', 'idiom.config', 'idiom.logging'];

const failures = [];
const warnings = [];
const fail = (check, msg) => failures.push(`${check}  ${msg}`);
const warn = (check, msg) => warnings.push(`${check}  ${msg}`);
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const exists = (p) => fs.existsSync(p);

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

function frontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (!m) return null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^"(.*)"$/, '$1');
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^"(.*)"$/, '$1')).filter(Boolean);
    fm[kv[1]] = v;
  }
  return fm;
}

const headings = (text, level = 2) => [...text.matchAll(new RegExp(`^${'#'.repeat(level)} (.+?)\\s*$`, 'gm'))].map((m) => m[1].trim());

// Text of one "## <name>" section (until the next heading of the same or higher level).
function section(text, name, level = 2) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^${'#'.repeat(level)} ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(l));
  if (start < 0) return null;
  const out = [];
  for (const l of lines.slice(start + 1)) {
    const h = l.match(/^(#{1,6}) /);
    if (h && h[1].length <= level) break;
    out.push(l);
  }
  return out.join('\n');
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

// Every markdown table whose header starts with `firstCol`; returns rows as {col: value}.
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
      rows.push(Object.fromEntries(head.map((h, k) => [h, c[k] ?? ''])));
    }
    out.push(rows);
    i = j;
  }
  return out;
}

const stripCode = (s) => s.replace(/`/g, '').trim();
const validEnforcedBy = (v) => ENFORCED_BY.some((e) => new RegExp(`^${e}\\b`, 'i').test(stripCode(v)));

// Resolve a `Source` / Reference-topics path; returns null for "—" / empty.
function resolveKnowledge(p) {
  const s = stripCode(p).replace(/\[([^\]]*)\]\(([^)]*)\)/, '$2');
  if (!s || s === '—' || s === '-' || /^_?none/i.test(s)) return null;
  const k = s.replace(/^\{\{AGENT_HOME\}\}\/knowledge\//, '').replace(/^knowledge\//, '');
  return path.join(knowledgeRoot, ...k.split('/'));
}

// ---- conventions.md: roles (§1) and profile dimensions (§4) -------------------
const convPath = path.join(root, 'conventions.md');
if (!exists(convPath)) { console.error(`conventions.md not found at ${convPath}`); process.exit(1); }
const conv = read(convPath);
const flowField = (line, name) => {
  const m = line.match(new RegExp(`\\b${name}:\\s*("[^"]*"|\\[[^\\]]*\\]|[^,}]+)`));
  return m ? m[1].trim().replace(/^"(.*)"$/, '$1') : undefined;
};
function yamlList(key) {
  const block = conv.match(new RegExp(`^${key}:\\s*\\r?\\n((?:[ \\t]+- \\{.*\\}[ \\t]*\\r?\\n?)+)`, 'm'));
  if (!block) { fail('CONV', `conventions.md has no parsable "${key}:" YAML block (one flow-mapping per line)`); return []; }
  return block[1].split(/\r?\n/).filter((l) => l.trim().startsWith('- {')).map((l) => l.trim());
}
const roles = yamlList('roles').map((l) => ({ id: flowField(l, 'id'), tag: flowField(l, 'tag'), tier: flowField(l, 'tier'), file: flowField(l, 'file') }));
const dims = yamlList('profile_dimensions').map((l) => ({ id: flowField(l, 'id'), folder: flowField(l, 'folder'), skill: flowField(l, 'skill'), tree: flowField(l, 'tree') }));
const roleIds = new Set();
for (const r of roles) {
  if (!r.id) { fail('CONV', 'role entry without id'); continue; }
  if (roleIds.has(r.id)) fail('CONV', `duplicate role id ${r.id}`);
  roleIds.add(r.id);
}
const dimIds = new Set();
for (const d of dims) {
  if (!d.id) { fail('CONV', 'profile dimension without id'); continue; }
  if (dimIds.has(d.id)) fail('CONV', `duplicate profile dimension ${d.id}`);
  dimIds.add(d.id);
}

// ---- trees: prefixes, nodes, Default / Escalate when, branch targets -------------
const treePrefixes = new Map(); // prefix -> file
const definedNodes = new Set();
const treeFiles = walk(path.join(root, 'trees')).filter((f) => f.endsWith('.tree.md'));
const pendingTargets = [];
for (const f of treeFiles) {
  const text = read(f);
  const fm = frontMatter(text) || {};
  if (fm.schema !== 'tree/v2') fail('TREE', `${rel(f)}: front-matter schema must be tree/v2 (got ${fm.schema ?? 'none'})`);
  for (const k of ['prefix', 'owner', 'phases', 'feeds']) if (!fm[k] || (Array.isArray(fm[k]) && !fm[k].length)) fail('TREE', `${rel(f)}: front-matter ${k} missing`);
  const prefix = fm.prefix;
  if (prefix) {
    if (!/^[A-Z]{2,5}$/.test(prefix)) fail('TREE', `${rel(f)}: prefix ${prefix} must be 2-5 capital letters`);
    if (treePrefixes.has(prefix)) fail('TREE', `prefix ${prefix} used by ${rel(f)} and ${treePrefixes.get(prefix)}`);
    treePrefixes.set(prefix, rel(f));
  }
  if (fm.owner && !roleIds.has(fm.owner)) fail('TREE', `${rel(f)}: owner ${fm.owner} is not a role in conventions.md §1`);
  const lines = text.split(/\r?\n/);
  let current = null; let body = [];
  const close = () => {
    if (!current) return;
    const t = body.join('\n');
    if (!/^- \*\*Default:\*\*/m.test(t)) fail('TREE', `${rel(f)} ${current}: missing "- **Default:**"`);
    if (!/^- \*\*Escalate when:\*\*/m.test(t)) fail('TREE', `${rel(f)} ${current}: missing "- **Escalate when:**"`);
    const branches = (t.match(/^- \*\*Branches:\*\*[\s\S]*?(?=^- \*\*(?!Branches)|(?![\s\S]))/m) || [''])[0];
    for (const m of branches.matchAll(/→\s*`?([A-Z]{2,5}-Q\d+[a-z]?)\b/g)) pendingTargets.push({ file: rel(f), node: current, target: m[1] });
  };
  for (const line of lines) {
    const m = line.match(/^### ([A-Z]{2,5}-Q\d+[a-z]?) — /);
    if (m) {
      close(); current = m[1]; body = [];
      if (prefix && !current.startsWith(prefix + '-')) fail('TREE', `${rel(f)}: node ${current} does not use prefix ${prefix}`);
      if (definedNodes.has(current)) fail('TREE', `node ${current} defined twice`);
      definedNodes.add(current);
      continue;
    }
    if (/^#{1,3} /.test(line)) { close(); current = null; body = []; continue; }
    if (current) body.push(line);
  }
  close();
}
for (const t of pendingTargets) if (!definedNodes.has(t.target)) fail('TREE', `${t.file} ${t.node}: branch target ${t.target} is not defined`);
for (const d of dims) if (d.tree && d.tree !== 'none' && d.tree !== '—' && !treePrefixes.has(d.tree)) fail('CONV', `dimension ${d.id}: tree ${d.tree} has no trees/*.tree.md with that prefix`);

const nodeIdRe = treePrefixes.size ? new RegExp(`\\b(?:${[...treePrefixes.keys()].join('|')})-Q\\d+[a-z]?\\b`, 'g') : null;

// ---- rule tables (shared helper) ----------------------------------------------------
const rulePrefixes = new Map(); // prefix -> file
const allRuleIds = new Map(); // id -> {file, enforced}
function claimPrefix(prefix, f) {
  if (!prefix) return;
  if (rulePrefixes.has(prefix)) fail('IDS', `rule-prefix ${prefix} used by ${rel(f)} and ${rulePrefixes.get(prefix)}`);
  else rulePrefixes.set(prefix, rel(f));
}
function checkRules(f, text, idPattern, { needSource = false } = {}) {
  const sect = section(text, 'Rules') ?? '';
  const found = tables(sect, 'Id').flat();
  const ids = [];
  for (const row of found) {
    const id = stripCode(row.Id);
    if (!id) continue;
    if (!idPattern.test(id)) { fail('RULE', `${rel(f)}: rule id ${id} does not match ${idPattern}`); continue; }
    if (allRuleIds.has(id)) fail('RULE', `${rel(f)}: rule id ${id} already defined in ${allRuleIds.get(id).file}`);
    for (const col of ['Rule', 'Holds when', 'Typical violation', 'Enforced by']) if (!(col in row) || !row[col]) fail('RULE', `${rel(f)} ${id}: column "${col}" missing or empty`);
    if (row['Enforced by'] && !validEnforcedBy(row['Enforced by'])) fail('RULE', `${rel(f)} ${id}: Enforced by "${row['Enforced by']}" is not one of ${ENFORCED_BY.join('|')}`);
    if ('Source' in row) {
      const src = resolveKnowledge(row.Source);
      if (src && !exists(src)) (needSource ? fail : warn)('SRC', `${rel(f)} ${id}: Source ${stripCode(row.Source)} does not exist`);
      if (src && exists(src)) {
        const kfm = frontMatter(read(src)) || {};
        if (kfm.status === 'stale') warn('SRC', `${rel(f)} ${id}: Source is stale: ${stripCode(row.Source)}`);
        if (kfm.schema === 'deep-dive/v1' && Array.isArray(kfm['synthesized-into']) && kfm['synthesized-into'].length) warn('SRC', `${rel(f)} ${id}: Source is a deep dive that has been synthesized; cite the derived doc`);
      }
    } else fail('RULE', `${rel(f)} ${id}: Source column missing`);
    allRuleIds.set(id, { file: rel(f), enforced: stripCode(row['Enforced by'] || '') });
    ids.push(id);
  }
  if (!found.length) fail('RULE', `${rel(f)}: "## Rules" has no rule table (Id | Rule | Holds when | Typical violation | Enforced by | Source)`);
  return ids;
}

// ---- foundations ---------------------------------------------------------------------------
const foundationRules = []; // {id, enforced}
const foundationFiles = walk(path.join(root, 'foundations')).filter((f) => f.endsWith('.md'));
for (const f of foundationFiles) {
  const text = read(f);
  const fm = frontMatter(text) || {};
  const subject = path.basename(path.dirname(f));
  if (fm.schema !== 'foundation/v2') fail('FND', `${rel(f)}: schema must be foundation/v2 (got ${fm.schema ?? 'none'})`);
  if (!SUBJECTS.includes(subject)) fail('FND', `${rel(f)}: folder ${subject} is not a subject (${SUBJECTS.join(', ')})`);
  if (fm.subject !== subject) fail('FND', `${rel(f)}: subject ${fm.subject} does not match folder ${subject}`);
  if (!fm['rule-prefix']) { fail('FND', `${rel(f)}: rule-prefix missing`); continue; }
  claimPrefix(fm['rule-prefix'], f);
  const hs = headings(text);
  const order = ['Rules', 'Interpreting', 'Tensions', 'References', 'Related'];
  const idx = order.map((h) => hs.indexOf(h));
  order.forEach((h, i) => { if (idx[i] < 0) fail('FND', `${rel(f)}: section "## ${h}" missing`); });
  if (idx.every((i) => i >= 0) && idx.some((v, i) => i && v < idx[i - 1])) fail('FND', `${rel(f)}: sections out of order (${order.join(' → ')})`);
  for (const id of checkRules(f, text, new RegExp(`^${fm['rule-prefix']}-\\d+$`))) foundationRules.push({ id, enforced: allRuleIds.get(id).enforced });
}

// ---- stacks ----------------------------------------------------------------------------------
const toolNames = new Set();
const stacksDir = path.join(root, 'stacks');
const stackIds = exists(stacksDir) ? fs.readdirSync(stacksDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
const stackSupports = new Map(); // stack -> paradigms[] (front-matter)
for (const stack of stackIds) {
  const dir = path.join(stacksDir, stack);
  const idx = path.join(dir, 'index.md');
  if (!exists(idx)) { fail('STACK', `stacks/${stack}: missing index.md`); continue; }
  const text = read(idx);
  const fm = frontMatter(text) || {};
  if (fm.schema !== 'stack/v2') fail('STACK', `stacks/${stack}/index.md: schema must be stack/v2`);
  if (fm.id !== stack) fail('STACK', `stacks/${stack}/index.md: id ${fm.id} does not match folder`);
  for (const k of ['detect-by', 'frameworks', 'paradigms']) if (!(k in fm)) fail('STACK', `stacks/${stack}/index.md: front-matter ${k} missing`);
  const slots = new Map();
  for (const line of (section(text, 'Slots') ?? text).split(/\r?\n/)) {
    const m = line.match(/^\|\s*`([a-z_.]+)`\s*\|\s*(.*?)\s*\|\s*$/);
    if (m) slots.set(m[1], m[2]);
  }
  for (const s of SLOTS) if (!slots.get(s)) fail('STACK', `stacks/${stack}: slot ${s} missing or empty`);
  for (const t of (slots.get('tools') || '').replace(/`/g, '').split(',')) if (t.trim()) toolNames.add(t.trim().toLowerCase());
  const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const fws = asList(fm.frameworks);
  const fwDisk = walk(path.join(dir, 'frameworks')).filter((f) => f.endsWith('.md')).map((f) => path.basename(f, '.md'));
  if ([...fws].sort().join() !== [...fwDisk].sort().join()) fail('STACK', `stacks/${stack}: frameworks [${fws}] ≠ files on disk [${fwDisk}]`);
  const pds = asList(fm.paradigms);
  stackSupports.set(stack, pds);
  const pdDisk = walk(path.join(dir, 'paradigms')).filter((f) => f.endsWith('.md')).map((f) => path.basename(f, '.md'));
  if ([...pds].sort().join() !== [...pdDisk].sort().join()) fail('STACK', `stacks/${stack}: paradigms [${pds}] ≠ overlay files on disk [${pdDisk}]`);
  for (const row of tables(section(text, 'Reference topics') ?? '', 'Topic').flat()) {
    const p = resolveKnowledge(row.Path || '');
    if (!p) continue;
    if (!exists(p)) { fail('STACK', `stacks/${stack}: Reference topic path does not exist: ${stripCode(row.Path)}`); continue; }
    const s = (frontMatter(read(p)) || {}).schema;
    if (s && !['knowledge-doc/v1', 'deep-dive/v1'].includes(s)) warn('STACK', `stacks/${stack}: Reference topic ${stripCode(row.Path)} has unknown schema ${s}`);
  }

  // reference.md (optional): a pointer to the stack's reference repo, pinned by tag and commit (stack-reference/v1).
  // The code lives in its own repo and is checked there (pnpm run check + validate-project.mjs in its CI).
  if (exists(path.join(dir, 'reference'))) fail('REF', `stacks/${stack}/reference/: in-tree reference projects were replaced by stack-reference pointers (reference.md); move the code to its own repo`);
  const refPath = path.join(dir, 'reference.md');
  if (exists(refPath)) {
    const rtext = read(refPath);
    const rfm = frontMatter(rtext) || {};
    const label = `stacks/${stack}/reference.md`;
    if (rfm.schema !== 'stack-reference/v1') fail('REF', `${label}: schema must be stack-reference/v1`);
    if (rfm.stack !== stack) fail('REF', `${label}: stack ${rfm.stack} does not match folder`);
    if (!/^[\w.-]+\/[\w.-]+$/.test(String(rfm.repo ?? ''))) fail('REF', `${label}: repo must be owner/name`);
    if (!rfm.pinned) fail('REF', `${label}: pinned (the release tag) missing`);
    if (!/^[0-9a-f]{40}$/.test(String(rfm.commit ?? ''))) fail('REF', `${label}: commit must be a full 40-character SHA (a tag can move)`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(rfm.verified ?? ''))) fail('REF', `${label}: verified must be a YYYY-MM-DD date`);
    else if ((Date.now() - Date.parse(rfm.verified)) / 86400000 > 90) warn('REF', `${label}: verified ${rfm.verified}, more than 90 days ago; re-run the reference's checks at the pin and update verified`);
    const rhs = headings(rtext);
    for (const s of ['What it shows', 'Choices', 'File map', 'How to fetch', 'How to check', 'Using it in a repo', 'References', 'Related']) {
      if (!rhs.includes(s)) fail('REF', `${label}: section "## ${s}" missing`);
    }
    if (rfm.commit && !rtext.replace(/^---[\s\S]*?\n---/, '').includes(String(rfm.commit))) fail('REF', `${label}: How to fetch must check out the pinned commit ${rfm.commit}`);
    if (rfm.repo && rfm.pinned) refPins.push([stack, rfm.repo, rfm.pinned]);
    // variants: other maintained layouts, one flow mapping per line (stack-reference/v1, 1.2.0).
    const vblock = (rtext.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '').match(/^variants:\s*\r?\n((?:[ \t]+- \{.*\}[ \t]*\r?\n?)+)/m);
    const variants = vblock ? vblock[1].split(/\r?\n/).filter((l) => l.trim().startsWith('- {')) : [];
    if (variants.length && !['feature-first', 'layer-first'].includes(rfm.layout)) fail('REF', `${label}: layout (feature-first or layer-first) is required when variants are listed`);
    if (variants.length && !rhs.includes('Which layout')) fail('REF', `${label}: section "## Which layout" missing (required with variants)`);
    for (const v of variants) {
      const vl = flowField(v, 'layout') ?? '<unnamed>';
      for (const k of ['layout', 'branch', 'pinned', 'commit', 'verified']) if (!flowField(v, k)) fail('REF', `${label}: variant ${vl} lacks ${k}`);
      const vc = flowField(v, 'commit') ?? '';
      if (!/^[0-9a-f]{40}$/.test(vc)) fail('REF', `${label}: variant ${vl} commit must be a full 40-character SHA`);
      else if (!rtext.replace(/^---[\s\S]*?\n---/, '').includes(vc)) fail('REF', `${label}: How to fetch must also check out variant ${vl}'s commit ${vc}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(flowField(v, 'verified') ?? '')) fail('REF', `${label}: variant ${vl} verified must be a YYYY-MM-DD date`);
    }
  }

  // idioms.md
  const idiomsPath = path.join(dir, 'idioms.md');
  if (!exists(idiomsPath)) { fail('STACK', `stacks/${stack}: missing idioms.md`); continue; }
  const itext = read(idiomsPath);
  const ifm = frontMatter(itext) || {};
  if (ifm.schema !== 'stack-idioms/v1') fail('IDIOM', `stacks/${stack}/idioms.md: schema must be stack-idioms/v1`);
  if (ifm.stack !== stack) fail('IDIOM', `stacks/${stack}/idioms.md: stack ${ifm.stack} does not match folder`);
  const ihs = headings(itext);
  for (const s of IDIOM_SECTIONS) if (!ihs.includes(s)) fail('IDIOM', `stacks/${stack}/idioms.md: section "## ${s}" missing`);
  if (ifm['rule-prefix']) {
    claimPrefix(ifm['rule-prefix'], idiomsPath);
    const re = new RegExp(`^${ifm['rule-prefix']}-\\d+$`);
    const idRows = tables(itext, 'Id').flat().filter((r) => re.test(stripCode(r.Id)));
    for (const r of idRows) {
      const id = stripCode(r.Id);
      if (allRuleIds.has(id)) fail('IDIOM', `stacks/${stack}/idioms.md: rule id ${id} duplicated`);
      allRuleIds.set(id, { file: rel(idiomsPath), enforced: stripCode(r['Enforced by'] || '') });
      if (r['Enforced by'] && !validEnforcedBy(r['Enforced by'])) fail('IDIOM', `stacks/${stack}/idioms.md ${id}: invalid Enforced by "${r['Enforced by']}"`);
    }
    const perf = section(itext, 'Runtime & performance') ?? '';
    for (const r of tables(perf, 'Id').flat()) if (!resolveKnowledge(r.Source || '')) warn('IDIOM', `stacks/${stack}/idioms.md ${stripCode(r.Id)}: runtime & performance rule has no Source (knowledge seeding is phase 3)`);
  } else fail('IDIOM', `stacks/${stack}/idioms.md: rule-prefix missing`);
  const mapped = (section(itext, 'Enforcement') ?? '') + '\n' + (section(text, 'Foundation mapping') ?? '');
  const unmapped = foundationRules.filter((r) => /^(lint|typecheck|test)\b/.test(r.enforced) && !new RegExp(`\\b${r.id}\\b`).test(mapped));
  if (unmapped.length) warn('IDIOM', `stacks/${stack}: ${unmapped.length} foundation rule(s) enforced by lint/typecheck/test have no Enforcement/Foundation-mapping row: ${unmapped.map((r) => r.id).join(', ')}`);

  // frameworks/<fw>.md
  for (const fw of fwDisk) {
    const fp = path.join(dir, 'frameworks', `${fw}.md`);
    const ft = read(fp);
    const ffm = frontMatter(ft) || {};
    if (ffm.schema !== 'stack-framework/v1') fail('FW', `${rel(fp)}: schema must be stack-framework/v1`);
    if (ffm.stack !== stack || ffm.framework !== fw) fail('FW', `${rel(fp)}: stack/framework front-matter must be ${stack}/${fw}`);
    if (!ffm['rule-prefix']) { fail('FW', `${rel(fp)}: rule-prefix missing`); continue; }
    claimPrefix(ffm['rule-prefix'], fp);
    const re = new RegExp(`^${ffm['rule-prefix']}-\\d+$`);
    for (const r of tables(ft, 'Id').flat().filter((x) => /^[A-Z]+-\d+$/.test(stripCode(x.Id)))) {
      const id = stripCode(r.Id);
      if (!re.test(id)) fail('FW', `${rel(fp)}: rule id ${id} does not use prefix ${ffm['rule-prefix']}`);
      else if (allRuleIds.has(id)) fail('FW', `${rel(fp)}: rule id ${id} duplicated`);
      else allRuleIds.set(id, { file: rel(fp), enforced: stripCode(r['Enforced by'] || '') });
    }
  }
}

// ---- paradigms -------------------------------------------------------------------------------
const paradigmIds = [];
for (const f of walk(path.join(root, 'paradigms')).filter((x) => x.endsWith('.md'))) {
  const text = read(f);
  const fm = frontMatter(text) || {};
  const id = path.basename(f, '.md');
  paradigmIds.push(id);
  if (fm.schema !== 'paradigm/v1') fail('PDM', `${rel(f)}: schema must be paradigm/v1 (got ${fm.schema ?? 'none'})`);
  if (fm.id !== id) fail('PDM', `${rel(f)}: id ${fm.id} does not match file name`);
  if (!/^\d+$/.test(String(fm.version ?? ''))) fail('PDM', `${rel(f)}: version must be a major number`);
  const hs = headings(text);
  let last = -1;
  for (const s of PARADIGM_SECTIONS) {
    const i = hs.indexOf(s);
    if (i < 0) fail('PDM', `${rel(f)}: section "## ${s}" missing`);
    else if (i < last) fail('PDM', `${rel(f)}: section "## ${s}" out of order`);
    else last = i;
  }
  const ids = checkRules(f, text, new RegExp(`^PDM-${id.replace(/[-]/g, '\\-')}-R\\d+$`));
  const supports = Array.isArray(fm.supports) ? fm.supports : fm.supports ? [fm.supports] : [];
  for (const s of supports) {
    if (!stackIds.includes(s)) { fail('PDM', `${rel(f)}: supports unknown stack ${s}`); continue; }
    const ov = path.join(stacksDir, s, 'paradigms', `${id}.md`);
    if (!exists(ov)) { fail('PDM', `${rel(f)}: supports ${s} but stacks/${s}/paradigms/${id}.md is missing`); continue; }
    const ot = read(ov);
    const ofm = frontMatter(ot) || {};
    if (ofm.schema !== 'stack-paradigm/v1') fail('PDM', `${rel(ov)}: schema must be stack-paradigm/v1`);
    if (ofm.stack !== s || String(ofm.paradigm) !== `${id}@${fm.version}`) fail('PDM', `${rel(ov)}: front-matter must be stack: ${s}, paradigm: ${id}@${fm.version}`);
    for (const h of ['Shape mapping', 'Example', 'Counter-example', 'Enforcement', 'References', 'Related']) if (!headings(ot).includes(h)) fail('PDM', `${rel(ov)}: section "## ${h}" missing`);
    const enf = section(ot, 'Enforcement') ?? '';
    for (const rid of ids) if (/^(lint|typecheck|test)\b/.test(allRuleIds.get(rid).enforced) && !new RegExp(`\\b${rid}\\b`).test(enf)) fail('PDM', `${rel(ov)}: ${rid} is enforced by ${allRuleIds.get(rid).enforced} but has no Enforcement row`);
  }
  for (const s of stackIds) if (!supports.includes(s) && exists(path.join(stacksDir, s, 'paradigms', `${id}.md`))) fail('PDM', `stacks/${s}/paradigms/${id}.md exists but ${rel(f)} does not list ${s} in supports`);
}
for (const [stack, pds] of stackSupports) for (const p of pds) if (!paradigmIds.includes(p)) fail('STACK', `stacks/${stack}: paradigm ${p} has no paradigms/${p}.md`);

// ---- dimensions have folders ---------------------------------------------------------------
for (const d of dims) if (d.folder && !exists(path.join(root, d.folder.replace(/[<{].*$/, '').replace(/\/$/, '')))) fail('CONV', `dimension ${d.id}: folder ${d.folder} does not exist`);

// ---- roles -----------------------------------------------------------------------------------
const presets = new Map(); // role -> [paths]
for (const r of roles) {
  const f = path.join(root, r.file || `agents/${r.id}.md`);
  if (!exists(f)) { fail('ROLE', `role ${r.id}: ${rel(f)} missing`); continue; }
  const text = read(f);
  const fm = frontMatter(text) || {};
  if (fm.schema !== 'agent-role/v2') fail('ROLE', `${rel(f)}: schema must be agent-role/v2`);
  if (fm.id !== r.id) fail('ROLE', `${rel(f)}: id ${fm.id} ≠ conventions ${r.id}`);
  if (r.tag && r.tag !== '—' && String(fm.tag).replace(/^\[|\]$/g, '') !== r.tag.replace(/^\[|\]$/g, '')) fail('ROLE', `${rel(f)}: tag ${fm.tag} ≠ conventions ${r.tag}`);
  for (const h of ['Identity', 'Does NOT do', 'Preset knowledge', 'Runtime inputs', 'Trees owned', 'Modes', 'Review rubric', 'Standalone use', 'Escalate when', 'Output', 'References', 'Related']) {
    if (!headings(text).includes(h)) fail('ROLE', `${rel(f)}: section "## ${h}" missing`);
  }
  const list = [];
  for (const row of tables(section(text, 'Preset knowledge') ?? '', 'Doc').flat()) {
    const p = stripCode(row.Doc).replace(/\[([^\]]*)\]\(([^)]*)\)/, '$2');
    if (!p) continue;
    if (!p.startsWith('foundations/')) fail('ROLE', `${rel(f)}: Preset entry ${p} is not under foundations/`);
    else if (!exists(path.join(root, p))) fail('ROLE', `${rel(f)}: Preset entry ${p} does not exist`);
    list.push(p);
  }
  presets.set(r.id, list);
  const prefix = fm['rubric-prefix'];
  const rubric = tables(section(text, 'Review rubric') ?? '', 'Id').flat();
  const seen = new Set();
  for (const row of rubric) {
    const id = stripCode(row.Id);
    if (!id) continue;
    if (!prefix || !new RegExp(`^${prefix}-R\\d+$`).test(id)) fail('ROLE', `${rel(f)}: rubric id ${id} does not use rubric-prefix ${prefix}`);
    if (seen.has(id)) fail('ROLE', `${rel(f)}: rubric id ${id} duplicated`);
    seen.add(id);
    if (row['Enforced by'] && !validEnforcedBy(row['Enforced by'])) fail('ROLE', `${rel(f)} ${id}: invalid Enforced by "${row['Enforced by']}"`);
  }
  if (prefix) claimPrefix(`${prefix}-R`, f);
}

// ---- citations: every tree node / rule id cited exists -------------------------------------
const citing = [...walk(path.join(root, 'agents')), ...foundationFiles, ...treeFiles, ...walk(path.join(root, 'paradigms')), ...walk(stacksDir), convPath, path.join(root, 'index.md')].filter((f) => f.endsWith('.md') && exists(f));
for (const f of citing) {
  const text = read(f);
  if (nodeIdRe) for (const id of new Set(text.match(nodeIdRe) || [])) if (!definedNodes.has(id)) fail('CITE', `${rel(f)} cites ${id}, which no tree defines`);
  if (rulePrefixes.size) {
    const re = new RegExp(`\\b(?:${[...rulePrefixes.keys()].filter((p) => !p.endsWith('-R')).join('|')})-\\d+\\b`, 'g');
    for (const id of new Set(text.match(re) || [])) if (!allRuleIds.has(id)) warn('CITE', `${rel(f)} cites ${id}, which no rule table defines`);
  }
}

// ---- V6: no stack tool names outside stacks/ ---------------------------------------------------
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toolRe = toolNames.size ? new RegExp(`(?<![\\w-])(${[...toolNames].map(escape).join('|')})(?![\\w-])`, 'gi') : null;
if (toolRe) {
  const scan = [...walk(path.join(root, 'agents')), ...foundationFiles, ...treeFiles, ...walk(path.join(root, 'paradigms')), convPath].filter((f) => f.endsWith('.md'));
  for (const f of scan) {
    read(f).split(/\r?\n/).forEach((line, i) => {
      const hits = line.match(toolRe);
      if (hits) fail('V6', `${rel(f)}:${i + 1} names stack-specific tool(s): ${[...new Set(hits)].join(', ')}`);
    });
  }
}

// ---- index.md: 15 numbered sections + References/Related ----------------------------------------
const indexPath = path.join(root, 'index.md');
if (exists(indexPath)) {
  const text = read(indexPath);
  const fm = frontMatter(text) || {};
  if (fm.schema !== 'framework-index/v1') fail('INDEX', `index.md: schema must be framework-index/v1`);
  const hs = headings(text);
  const nums = hs.map((h) => (h.match(/^(\d+)\. /) || [])[1]).filter(Boolean).map(Number);
  for (let n = 1; n <= 15; n++) if (!nums.includes(n)) fail('INDEX', `index.md: section "## ${n}. …" missing`);
  if (nums.some((v, i) => i && v < nums[i - 1])) fail('INDEX', 'index.md: numbered sections out of order');
  if (hs.at(-2) !== 'References' || hs.at(-1) !== 'Related') fail('INDEX', 'index.md: must end with ## References, ## Related');
  for (const m of text.matchAll(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g)) {
    const target = path.resolve(root, m[1].split('#')[0]);
    if (m[1].includes('{{')) continue;
    if (!exists(target)) fail('INDEX', `index.md: link ${m[1]} does not resolve`);
  }
} else fail('INDEX', 'index.md missing');

// ---- schemas: every schema in the _system.md registry exists ---------------------------------
const sysPath = path.join(root, 'schemas', '_system.md');
if (exists(sysPath)) {
  const reg = (section(read(sysPath), '4. Registry') ?? '').split(/^### 4\.4\b/m)[0];
  for (const m of new Set([...reg.matchAll(/`([a-z-]+\.schema\.md)`/g)].map((x) => x[1]))) if (!exists(path.join(root, 'schemas', m))) fail('SCHEMA', `_system.md §4 lists ${m}, which does not exist`);
}

// ---- wrappers and skills (agent-config repo) ------------------------------------------------------
if (repo) {
  const wrapped = roles.filter((r) => r.id !== 'orchestrator');
  for (const r of wrapped) {
    const files = [
      path.join(repo, 'copilot', 'agents', `sdlc-${r.id}.agent.md`),
      path.join(repo, 'claude', 'agents', `sdlc-${r.id}.md`),
      path.join(repo, 'codex', 'agents', `sdlc-${r.id}.toml`),
    ];
    for (const w of files) {
      if (!exists(w)) { fail('WRAP', `missing wrapper ${path.relative(repo, w)}`); continue; }
      const t = read(w);
      if (!new RegExp(`name\\s*[:=]\\s*"?sdlc-${r.id}"?\\s*$`, 'm').test(t)) fail('WRAP', `${path.relative(repo, w)}: name must be sdlc-${r.id}`);
      if (!t.includes(`agentic-sdlc/agents/${r.id}.md`) || !t.includes('Standalone use') || !t.includes('Never launch other agents')) fail('WRAP', `${path.relative(repo, w)}: body does not match the role-wrapper template`);
      if (w.endsWith('.agent.md') && !/^user-invocable: true\s*$/m.test(t)) fail('WRAP', `${path.relative(repo, w)}: user-invocable must be true`);
      if (w.includes(`${path.sep}claude${path.sep}`) && !new RegExp(`^\\s+- sdlc-${r.id}-preset\\s*$`, 'm').test(t)) fail('WRAP', `${path.relative(repo, w)}: skills must list sdlc-${r.id}-preset`);
    }
    // preset skill == role Preset table
    const sk = path.join(repo, 'skills', `sdlc-${r.id}-preset`, 'SKILL.md');
    if (!exists(sk)) { fail('SKILL', `missing skills/sdlc-${r.id}-preset/SKILL.md`); continue; }
    const listed = [...read(sk).matchAll(/^\d+\.\s+`~\/\.copilot\/frameworks\/agentic-sdlc\/([^`]+)`/gm)].map((m) => m[1]);
    const want = presets.get(r.id) || [];
    if (listed.join('\n') !== want.join('\n')) fail('SKILL', `skills/sdlc-${r.id}-preset: list [${listed.join(', ')}] ≠ agents/${r.id}.md Preset [${want.join(', ')}]`);
  }
  // Every Codex wrapper must parse as TOML, or Codex silently ignores it: in a basic string ("…" or """…"""), a
  // backslash starts an escape, so `%USERPROFILE%\.copilot` there is an error. Literal strings ('…', '''…''') are left alone.
  const codexDir = path.join(repo, 'codex', 'agents');
  if (exists(codexDir)) for (const f of fs.readdirSync(codexDir).filter((x) => x.endsWith('.toml')).sort()) {
    const bad = tomlEscapeError(read(path.join(codexDir, f)));
    if (bad) fail('WRAP', `codex/agents/${f}: line ${bad.line}: "\\${bad.char}" is not a TOML escape, so Codex ignores this file (put Windows paths in a '''…''' string)`);
  }
  for (const s of stackIds) if (!exists(path.join(repo, 'skills', `sdlc-stack-${s}`, 'SKILL.md'))) fail('SKILL', `missing skills/sdlc-stack-${s}/SKILL.md`);
  for (const p of paradigmIds) if (!exists(path.join(repo, 'skills', `sdlc-paradigm-${p}`, 'SKILL.md'))) fail('SKILL', `missing skills/sdlc-paradigm-${p}/SKILL.md`);
  for (const d of fs.readdirSync(path.join(repo, 'skills'))) {
    const m = d.match(/^sdlc-(stack|paradigm)-(.+)$/);
    if (m && !(m[1] === 'stack' ? stackIds : paradigmIds).includes(m[2])) fail('SKILL', `skills/${d} has no matching ${m[1]}`);
    if (/^sdlc-binding-|^sdlc-engineering-principles$/.test(d)) fail('SKILL', `skills/${d} is a v1 skill; remove it`);
  }
} else warn('WRAP', 'agent-config repo not found; wrapper and skill checks skipped (pass --repo <path>)');

// The first invalid escape in a TOML document's basic strings (TOML 1.0 escapes plus 1.1's \e and \xHH; in a
// multi-line string also a backslash that ends the line), or null.
function tomlEscapeError(text) {
  const strings = /'''[\s\S]*?'''|'[^'\n]*'|"""([\s\S]*?)"""|"((?:[^"\\\n]|\\.)*)"/g;
  for (const m of text.matchAll(strings)) {
    const body = m[1] ?? m[2]; if (body === undefined) continue;
    const at = m.index + m[0].indexOf(body);
    for (let i = 0; i < body.length; i++) {
      if (body[i] !== '\\') continue;
      const c = body[i + 1] ?? ''; const hex = (n) => new RegExp(`^[0-9A-Fa-f]{${n}}$`).test(body.slice(i + 2, i + 2 + n));
      const lineEnd = m[1] !== undefined && /^[ \t]*\r?\n/.test(body.slice(i + 1));
      if ('btnfr"\\e'.includes(c) && c !== '') { i++; continue; }
      if ((c === 'u' && hex(4)) || (c === 'U' && hex(8)) || (c === 'x' && hex(2)) || lineEnd) { i++; continue; }
      return { line: text.slice(0, at + i).split('\n').length, char: c };
    }
  }
  return null;
}

// ---- reference pins vs upstream (--upstream) ----------------------------------------------------
if (upstream) {
  const api = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
  const headers = { 'user-agent': 'agentic-sdlc-validate', accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
  for (const [stack, repoName, pinned] of refPins) {
    try {
      const res = await fetch(`${api}/repos/${repoName}/tags?per_page=100`, { headers, signal: AbortSignal.timeout(15000) });
      if (!res.ok) { warn('REF', `stacks/${stack}/reference.md: ${repoName} tags → HTTP ${res.status}`); continue; }
      const tags = (await res.json()).map((t) => t.name).filter((t) => /^v?\d+\.\d+\.\d+$/.test(t));
      const num = (t) => t.replace(/^v/, '').split('.').map(Number);
      const latest = tags.sort((a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; }).at(-1);
      if (latest && latest !== pinned) warn('REF', `stacks/${stack}/reference.md: pinned ${pinned}, the reference repo's latest tag is ${latest}; review it and bump pinned/commit/verified`);
    } catch (e) { warn('REF', `stacks/${stack}/reference.md: ${repoName} → ${e.name}: ${e.message}`); }
  }
}

// ---- report ------------------------------------------------------------------------------------
console.log(`agentic-sdlc validate (v2): ${roles.length} roles, ${dims.length} profile dimensions, ${foundationFiles.length} foundations, ` +
  `${treeFiles.length} trees / ${definedNodes.size} nodes, ${stackIds.length} stacks, ${paradigmIds.length} paradigms, ${allRuleIds.size} rule ids, ${toolNames.size} stack tool names`);
for (const w of warnings) console.log('  warn  ' + w);
if (failures.length) {
  console.log(`FAIL (${failures.length})`);
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log(`PASS${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
