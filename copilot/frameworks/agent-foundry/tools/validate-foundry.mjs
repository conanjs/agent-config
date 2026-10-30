#!/usr/bin/env node
// Validates the Agent Foundry framework: floors, charters, trees, and any lens folders.
// Usage: node validate-foundry.mjs [foundry-root] [--rules <foundations dir>]
//   foundry-root  default: this framework (tools/..)
//   --rules       agentic-sdlc foundations dir used to confirm rule ids exist
//                 (default: <foundry>/../agentic-sdlc/foundations; skipped with a warning if absent)
// Exit code 1 when any FAIL is reported. Plain Node, no dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(positional[0] ?? path.join(here, '..'));
const rulesRoot = path.resolve(flag('--rules') ?? path.join(root, '..', 'agentic-sdlc', 'foundations'));

let fails = 0, warns = 0;
const fail = (c, m) => { fails++; console.log(`FAIL ${c}: ${m}`); };
const warn = (c, m) => { warns++; console.log(`WARN ${c}: ${m}`); };
const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

function walk(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function frontMatter(text) {
  const m = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const k = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (k) out[k[1]] = k[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}
const headings = (t) => [...t.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);
function section(t, name) {
  const m = t.match(new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'm'));
  return m ? m[1] : null;
}
function tableRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
  if (lines.length < 3) return [];
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(lines[0]);
  return lines.slice(2).map((l) => Object.fromEntries(cells(l).map((c, i) => [head[i], c])));
}
const strip = (s = '') => s.replace(/`/g, '').trim();

// ---- rule ids from the rules root ------------------------------------------------------------
const ruleIds = new Set();
const haveRules = exists(rulesRoot);
if (haveRules) {
  for (const f of walk(rulesRoot).filter((p) => p.endsWith('.md'))) {
    for (const m of read(f).matchAll(/^\|\s*([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+)\s*\|/gm)) ruleIds.add(m[1]);
  }
} else warn('RULES', `rules root not found at ${rulesRoot}; rule-id existence not checked`);
const ruleExists = (id) => !haveRules || ruleIds.has(id);

// ---- front-matter on every markdown file -----------------------------------------------------
const mdFiles = walk(root).filter((p) => p.endsWith('.md'));
for (const f of mdFiles) {
  const fm = frontMatter(read(f));
  if (!fm || !fm.schema) fail('FM', `${rel(f)}: missing front-matter "schema"`);
  else if (!fm['last-updated']) fail('FM', `${rel(f)}: missing front-matter "last-updated"`);
}

// ---- floors ----------------------------------------------------------------------------------
const floors = new Set();
const floorsPath = path.join(root, 'floors.md');
if (!exists(floorsPath)) fail('FLOOR', 'floors.md missing');
else {
  const body = section(read(floorsPath), 'Floors') ?? '';
  for (const row of tableRows(body)) {
    const id = strip(row.Rule);
    if (!id) continue;
    floors.add(id);
    if (!ruleExists(id)) fail('FLOOR', `floors.md: rule ${id} does not exist in ${rulesRoot}`);
    if (!strip(row['Why it is a floor'])) fail('FLOOR', `floors.md: ${id} has no reason`);
  }
  if (!floors.size) fail('FLOOR', 'floors.md: no floors listed');
}

// ---- charters --------------------------------------------------------------------------------
const CHARTER_SECTIONS = ['Identity', 'Does NOT do', 'Principles', 'Knowledge bindings', 'Runtime inputs', 'Decision flow',
  'Modes', 'Review rubric', 'Lens', 'Autonomy', 'Eval', 'Escalate when', 'Output', 'References', 'Related'];
const AUTONOMY = ['suggest-only', 'comment', 'request-changes'];
for (const f of walk(path.join(root, 'charters')).filter((p) => p.endsWith('.charter.md'))) {
  const text = read(f), fm = frontMatter(text) || {};
  const stem = path.basename(f, '.charter.md');
  if (fm.schema !== 'charter/v1') fail('CHARTER', `${rel(f)}: schema must be charter/v1`);
  if (fm.id !== stem) fail('CHARTER', `${rel(f)}: id "${fm.id}" must equal file name "${stem}"`);
  if (!AUTONOMY.includes(fm.autonomy)) fail('CHARTER', `${rel(f)}: autonomy must be one of ${AUTONOMY.join('|')}`);
  for (const h of CHARTER_SECTIONS) if (!headings(text).includes(h)) fail('CHARTER', `${rel(f)}: section "## ${h}" missing`);
  if (fm['rubric-prefix'] && !/approve.*merge/i.test(section(text, 'Does NOT do') ?? '')) fail('CHARTER', `${rel(f)}: a reviewing agent's "Does NOT do" must include approving and merging`);
  const seen = new Set();
  for (const row of tableRows(section(text, 'Review rubric') ?? '')) {
    const id = strip(row.Id);
    if (!id) continue;
    if (!id.startsWith(`${fm['rubric-prefix']}-R`)) fail('CHARTER', `${rel(f)}: rubric id ${id} must start with ${fm['rubric-prefix']}-R`);
    if (seen.has(id)) fail('CHARTER', `${rel(f)}: duplicate rubric id ${id}`);
    seen.add(id);
    const rules = strip(row.Rules).split(/[,\s]+/).filter(Boolean);
    for (const r of rules) {
      if (!ruleExists(r)) fail('CHARTER', `${rel(f)} ${id}: rule ${r} does not exist`);
      if (floors.has(r) && strip(row['Severity if failed']) !== 'blocker') fail('CHARTER', `${rel(f)} ${id}: floor rule ${r} must be blocker`);
    }
  }
  for (const row of tableRows(section(text, 'Decision flow') ?? '')) {
    const t = strip(row.Tree);
    if (t && !exists(path.join(root, t))) fail('CHARTER', `${rel(f)}: tree ${t} does not exist`);
  }
}

// ---- trees -----------------------------------------------------------------------------------
for (const f of walk(path.join(root, 'trees')).filter((p) => p.endsWith('.tree.md'))) {
  const text = read(f), fm = frontMatter(text) || {};
  if (fm.schema !== 'tree/v2') fail('TREE', `${rel(f)}: schema must be tree/v2`);
  for (const k of ['prefix', 'owner', 'phases', 'feeds']) if (!fm[k]) fail('TREE', `${rel(f)}: front-matter "${k}" missing`);
  const nodes = [...text.matchAll(/^###\s+(\S+-Q\d+[a-z]?)\s+—\s+(.+)$/gm)];
  if (!nodes.length) fail('TREE', `${rel(f)}: no nodes`);
  const parts = text.split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const id = part.split(/\s/)[0];
    if (!id.startsWith(`${fm.prefix}-Q`)) continue;
    if (!/\*\*Default:\*\*/.test(part)) fail('TREE', `${rel(f)} ${id}: missing Default`);
    if (!/\*\*Escalate when:\*\*/.test(part)) fail('TREE', `${rel(f)} ${id}: missing Escalate when`);
  }
}

// ---- lens folders (any folder holding lessons/ or waivers/ or zones.md) ----------------------
const today = new Date().toISOString().slice(0, 10);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s));
const STATUS = ['candidate', 'active', 'contested', 'retired', 'rejected'];
const POLARITY = ['prefer', 'avoid', 'accept'];
const CONF = ['high', 'medium', 'low'];
const ZONES = ['owned', 'adopted', 'foreign'];
const SEV = ['blocker', 'major', 'minor', 'nit'];
const lensIds = new Map();

for (const f of mdFiles) {
  const r = rel(f);
  const text = read(f), fm = frontMatter(text) || {};
  if (fm.schema === 'lesson/v1') {
    for (const k of ['id', 'status', 'scope', 'polarity', 'confidence', 'expires', 'supersedes']) if (!fm[k]) fail('LESSON', `${r}: "${k}" missing`);
    if (!/^LS-\d+$/.test(fm.id || '')) fail('LESSON', `${r}: id must look like LS-<n>`);
    if (!STATUS.includes(fm.status)) fail('LESSON', `${r}: status must be ${STATUS.join('|')}`);
    if (!POLARITY.includes(fm.polarity)) fail('LESSON', `${r}: polarity must be ${POLARITY.join('|')}`);
    if (!CONF.includes(fm.confidence)) fail('LESSON', `${r}: confidence must be ${CONF.join('|')}`);
    if (!/^(team|repo|path):\S+/.test(fm.scope || '')) fail('LESSON', `${r}: scope must start with team:, repo: or path:`);
    if (!isDate(fm.expires)) fail('LESSON', `${r}: expires must be YYYY-MM-DD`);
    else if (fm.expires < today && fm.status === 'active') warn('LESSON', `${r}: active but expired on ${fm.expires}; retire or reconfirm`);
    if (!fm.adjusts && !fm['adds-check']) fail('LESSON', `${r}: needs "adjusts" or "adds-check"`);
    if (fm.adjusts) {
      const m = fm.adjusts.match(/^([A-Z][A-Z0-9-]*-\d+):\s*(\w+)\s*->\s*(\w+)$/);
      if (!m) fail('LESSON', `${r}: adjusts must look like RULE-1: major -> minor`);
      else {
        const [, rule, from, to] = m;
        if (floors.has(rule)) fail('LESSON', `${r}: adjusts floor rule ${rule}`);
        if (!ruleExists(rule)) fail('LESSON', `${r}: rule ${rule} does not exist`);
        if (SEV.indexOf(to) - SEV.indexOf(from) !== 1 || !SEV.includes(from) || !SEV.includes(to)) fail('LESSON', `${r}: severity must move exactly one step (${from} -> ${to})`);
      }
    }
    const ev = (section(text, 'Evidence') ?? '').split(/\r?\n/).filter((l) => /^\s*-\s+\S/.test(l)).length;
    if (fm.status === 'active' && ev < 3) fail('LESSON', `${r}: active lesson needs at least 3 evidence lines (has ${ev})`);
    const dir = path.dirname(f);
    const key = `${dir}:${fm.id}`;
    if (lensIds.has(key)) fail('LESSON', `${r}: duplicate id ${fm.id}`);
    lensIds.set(key, true);
  }
  if (fm.schema === 'waiver/v1') {
    for (const k of ['id', 'rule', 'scope', 'zone', 'owner', 'review-by']) if (!fm[k]) fail('WAIVER', `${r}: "${k}" missing`);
    if (!/^WV-\d+$/.test(fm.id || '')) fail('WAIVER', `${r}: id must look like WV-<n>`);
    if (floors.has(fm.rule)) fail('WAIVER', `${r}: waives floor rule ${fm.rule}`);
    if (fm.rule && !ruleExists(fm.rule)) fail('WAIVER', `${r}: rule ${fm.rule} does not exist`);
    if (!/^path:\S+/.test(fm.scope || '')) fail('WAIVER', `${r}: scope must be path:<glob>`);
    if (!ZONES.includes(fm.zone)) fail('WAIVER', `${r}: zone must be ${ZONES.join('|')}`);
    if (!isDate(fm['review-by'])) fail('WAIVER', `${r}: review-by must be YYYY-MM-DD`);
    else if (fm['review-by'] < today) warn('WAIVER', `${r}: review-by ${fm['review-by']} has passed; finding returns`);
  }
  if (fm.schema === 'zone-map/v1') {
    for (const k of ['repo', 'team']) if (!fm[k]) fail('ZONES', `${r}: "${k}" missing`);
    for (const row of tableRows(section(text, 'Zones') ?? '')) {
      const z = strip(row.Zone);
      if (!ZONES.includes(z)) fail('ZONES', `${r}: zone "${z}" for ${strip(row.Path)} must be ${ZONES.join('|')}`);
      if (z === 'foreign' && strip(row.Owner) === fm.team) fail('ZONES', `${r}: foreign path ${strip(row.Path)} must have an owner other than ${fm.team}`);
      if (z === 'adopted' && !strip(row.Reason)) fail('ZONES', `${r}: adopted path ${strip(row.Path)} needs a reason`);
    }
  }
}

console.log(`\nagent-foundry: ${fails} failure(s), ${warns} warning(s); ${mdFiles.length} markdown files, ${floors.size} floors, ${ruleIds.size} rule ids loaded`);
process.exit(fails ? 1 : 0);
