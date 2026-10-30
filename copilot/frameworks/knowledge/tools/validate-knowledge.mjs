#!/usr/bin/env node
// validate-knowledge.mjs — checks store B (global knowledge) against the knowledge framework schemas.
//
// Usage: node validate-knowledge.mjs [knowledge-root] [--sdlc <agentic-sdlc root>] [--companies <companies root>] [--urls]
//   knowledge-root  default: <this framework>/../../knowledge  (repo: copilot/knowledge, installed: ~/.copilot/knowledge)
//   --sdlc          agentic-sdlc root used for KD-4 backlinks  (default: <this framework>/../agentic-sdlc)
//   --companies     Company KB root used for the KB-2 deny-list (default: <this framework>/../../companies)
//   --urls          also run KB-3: every external URL in a v1 doc must answer HTTP < 400 (network; slow)
//
// Only v1 docs are checked (front-matter `schema:` = knowledge-doc/v1 | deep-dive/v1 | topic-index/v1).
// Legacy docs (no such schema) are skipped: schemas/_system.md §6, no retrofit.
//
// Every code printed is a rule id in ../schemas/ (a test checks this: tests/validate-knowledge/).
// Checks: knowledge-doc KD-1 (sections/order), KD-2 (verified ⇒ no ⚠️ + last-verified), KD-4 (Used by = real
// Source backlinks from agentic-sdlc), KD-6 (concept ≤ 400 lines, warn), KD-7 (derived-from ↔ synthesized-into),
// KD-9 (exact Verification status line, singular/plural, date = last-verified; counts warn);
// deep-dive DD-1, DD-3, DD-4 (warn); topic-index TI-1 … TI-7; shared KB-9 (front-matter values),
// KB-10 (only keys the schema defines), KB-11 (title and Summary head), KB-12 (References, Related, footnotes);
// KB-2 (company / repo names from the Company KB as a deny-list); KB-3 with --urls;
// KB-7 conversation residue (warn, heuristic); KB-8 duplicated fenced blocks across docs / repeated paragraphs (warn).
// LLM-only rules (KD-3, KD-5, KD-8, KB-1, KB-5, KB-6, KB-7 in full, DD-2) are not checked here:
// see {{AGENT_HOME}}/procedures/review-docs.procedure.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const checkUrls = args.includes('--urls'); if (checkUrls) args.splice(args.indexOf('--urls'), 1);
const here = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const fwRoot = path.resolve(here, '..');
const sdlcRoot = path.resolve(flag('--sdlc') ?? path.join(fwRoot, '..', 'agentic-sdlc'));
const companiesRoot = path.resolve(flag('--companies') ?? path.join(fwRoot, '..', '..', 'companies'));
const kRoot = fs.realpathSync(path.resolve(args[0] ?? path.join(fwRoot, '..', '..', 'knowledge')));

const fails = []; const warns = [];
const fail = (code, msg) => fails.push(`  ${code}  ${msg}`);
const warn = (code, msg) => warns.push(`  warn  ${code}  ${msg}`);
const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const rel = (p) => path.relative(kRoot, p).split(path.sep).join('/');
const today = new Date().toISOString().slice(0, 10);

// ---- tiny YAML front-matter parser (scalars, [inline], block lists, block lists of maps) ----------
function scalar(v) {
  v = v.trim();
  if (!/^["']/.test(v)) v = v.replace(/\s+#.*$/, '');
  if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map((s) => scalar(s)).filter((s) => s !== '');
  if (/^\{.*\}$/.test(v)) return Object.fromEntries(v.slice(1, -1).split(',').map((kv) => kv.split(':')).filter((a) => a.length >= 2).map(([k, ...r]) => [k.trim(), scalar(r.join(':'))]));
  return v.replace(/^(["'])(.*)\1$/, '$2');
}
function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fm = {}; let key = null;
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const top = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (top) { key = top[1]; fm[key] = top[2] === '' ? [] : scalar(top[2]); continue; }
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && key) {
      if (!Array.isArray(fm[key])) fm[key] = [];
      const kv = item[1].match(/^([\w-]+):\s*(.*)$/);
      fm[key].push(kv && !/^\w+:\/\//.test(item[1]) ? { [kv[1]]: scalar(kv[2]) } : scalar(item[1]));
      continue;
    }
    const cont = line.match(/^\s+([\w-]+):\s*(.*)$/);
    if (cont && key && Array.isArray(fm[key]) && typeof fm[key].at(-1) === 'object') fm[key].at(-1)[cont[1]] = scalar(cont[2]);
  }
  return fm;
}
const body = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, '');
const stripFences = (t) => t.replace(/^(`{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
const h2s = (t) => [...stripFences(t).matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);
function section(t, name) {
  const clean = stripFences(t);
  const i = clean.search(new RegExp(`^## ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'));
  if (i < 0) return null;
  const rest = clean.slice(i).split('\n').slice(1).join('\n');
  const j = rest.search(/^## /m);
  return j < 0 ? rest : rest.slice(0, j);
}
function tables(t) {
  const out = []; let cur = null;
  for (const line of t.split('\n')) {
    if (/^\s*\|/.test(line)) {
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (!cur) cur = { head: cells, rows: [] };
      else if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      else cur.rows.push(Object.fromEntries(cur.head.map((h, i) => [h, cells[i] ?? ''])));
    } else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}
const stripCode = (s) => s.replace(/`/g, '').trim();
const linkTarget = (cell) => { const m = cell.match(/\]\(([^)]+)\)/); return stripCode(m ? m[1] : cell); };

// ---- schema shapes ------------------------------------------------------------------------------
const TYPES = {
  concept: [['Problem', 1], ['Mental model', 1], ['How it works', 1], ['Worked example', 1], ['Edge cases', 1], ['Trade-offs', 0], ['Case studies', 0]],
  'how-to': [['Goal & prerequisites', 1], ['Steps', 1], ['Verify', 1], ['Troubleshooting', 1], ['Rollback', 0]],
  reference: [['Scope', 1], ['Catalog', 1], ['Lookup notes', 0]],
  'case-study': [['Context', 1], ['Symptom', 1], ['Root cause', 1], ['Fix', 1], ['Timeline', 0], ['Generalized lesson', 1]],
};
const TAIL = ['Takeaways', 'Used by', 'Verification status', 'References', 'Related'];
const STATUS = ['draft', 'verified', 'stale'];
const V1 = ['knowledge-doc/v1', 'deep-dive/v1', 'topic-index/v1'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Front-matter keys each schema defines (schemas/*.schema.md "Front-matter" tables). Anything else fails KB-10.
const KEYS = {
  'knowledge-doc/v1': ['schema', 'type', 'topic', 'status', 'applies-to', 'last-verified', 'last-updated', 'tags', 'derived-from'],
  'deep-dive/v1': ['schema', 'topic', 'status', 'applies-to', 'last-updated', 'last-verified', 'synthesized-into', 'tags'],
  'topic-index/v1': ['schema', 'kind', 'topic', 'last-updated'],
};
// KB-7 heuristics: text that only makes sense inside the conversation it was drafted in.
const RESIDUE = [
  [/^\*\*(Yes|No)[,.!:]/m, 'paragraph opens with a bare "Yes"/"No" answer; state the question it answers'],
  [/\b(as (we|I) (discussed|mentioned)|you asked|your (question|request)|as requested|in (my|the) (previous|earlier|last) (answer|message|reply|turn)|earlier in (this|our|the) (chat|conversation)|(this|our) (chat|conversation))\b/i, 'refers to a conversation the reader cannot see'],
];

function checkSequence(f, got, expected) {
  // expected: [[name, required]]; got must be the required ones in order plus optional ones in their slots, nothing else.
  let i = 0;
  for (const h of got) {
    while (i < expected.length && expected[i][0] !== h && !expected[i][1]) i++;
    if (i >= expected.length || expected[i][0] !== h) return fail('KD-1', `${rel(f)}: unexpected or out-of-order section "## ${h}" (expected order: ${expected.map((e) => e[0] + (e[1] ? '' : '?')).join(' → ')})`);
    i++;
  }
  const missing = expected.slice(i).filter((e) => e[1]).map((e) => e[0]);
  if (missing.length) fail('KD-1', `${rel(f)}: missing section(s) ${missing.map((m) => `"## ${m}"`).join(', ')}`);
}

function checkKeys(f, fm) {
  const allowed = KEYS[fm.schema] ?? [];
  for (const k of Object.keys(fm)) if (!allowed.includes(k)) fail('KB-10', `${rel(f)}: front-matter key "${k}" is not defined by ${fm.schema} (allowed: ${allowed.join(', ')})`);
}

function checkCommonFrontMatter(f, fm, kind) {
  for (const k of ['topic', 'status', 'applies-to', 'last-updated']) if (fm[k] === undefined || fm[k] === '') fail('KB-9', `${rel(f)}: front-matter "${k}" missing`);
  if (fm.status && !STATUS.includes(fm.status)) fail('KB-9', `${rel(f)}: status "${fm.status}" not one of ${STATUS.join('|')}`);
  if (fm['applies-to'] !== undefined && !Array.isArray(fm['applies-to'])) fail('KB-9', `${rel(f)}: applies-to must be a list`);
  if (fm['last-updated'] && !DATE.test(fm['last-updated'])) fail('KB-9', `${rel(f)}: last-updated must be YYYY-MM-DD`);
  const folder = path.relative(kRoot, path.dirname(f)).split(path.sep).join('/');
  if (fm.topic && fm.topic !== folder) fail('KB-9', `${rel(f)}: topic "${fm.topic}" ≠ folder "${folder}"`);
  if (fm.status === 'verified') {
    if (!fm['last-verified'] || !DATE.test(fm['last-verified'])) fail(kind === 'deep-dive' ? 'KB-9' : 'KD-2', `${rel(f)}: status verified needs last-verified (YYYY-MM-DD)`);
  }
}

function checkSummary(f, t, needDepth) {
  const s = section(t, 'Summary');
  if (s === null) return;
  if (!/\*\*TL;DR:\*\*/.test(s)) fail('KB-11', `${rel(f)}: Summary lacks **TL;DR:**`);
  if (!/\*\*Use this when:\*\*/.test(s)) fail('KB-11', `${rel(f)}: Summary lacks **Use this when:**`);
  if (needDepth && !/\*\*Depth:\*\*/.test(s)) fail('DD-1', `${rel(f)}: Summary lacks **Depth:**`);
}

function checkTail(f, t, fm) {
  const refs = section(t, 'References');
  if (refs !== null && !/^\s*[-*] /m.test(refs)) fail('KB-12', `${rel(f)}: References has no entries`);
  const rel_ = section(t, 'Related');
  if (rel_ !== null && !/^\s*[-*] /m.test(rel_)) fail('KB-12', `${rel(f)}: Related is empty (use "- _None yet._")`);
  const b = stripFences(body(t));
  const used = new Set([...b.replace(refs ?? '', '').matchAll(/\[\^(\w+)\](?!:)/g)].map((m) => m[1]));
  const defined = new Set([...(refs ?? '').matchAll(/\[\^(\w+)\]/g)].map((m) => m[1]));
  for (const n of used) if (!defined.has(n)) fail('KB-12', `${rel(f)}: footnote [^${n}] is used but no References entry carries it`);
  if (fm.status === 'verified' && /⚠️\s*unverified/.test(b.replace(section(t, 'Verification status') ?? '', ''))) fail('KD-2', `${rel(f)}: status verified but contains "⚠️ unverified" claims`);
}

// ---- collect files ------------------------------------------------------------------------------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}
const docs = new Map(); // abs path -> { fm, text }
for (const f of walk(kRoot)) {
  const text = read(f); const fm = frontMatter(text);
  if (fm && V1.includes(fm.schema)) docs.set(f, { fm, text });
}

// ---- KD-4 backlinks: Source cells and Reference topics in agentic-sdlc ---------------------------
const backlinks = new Map(); // knowledge-relative path -> Set(ids)
if (exists(sdlcRoot)) {
  for (const f of walk(sdlcRoot).filter((p) => !/[\\/](schemas|tools)[\\/]/.test(p))) {
    const t = read(f);
    for (const tb of tables(stripFences(body(t)))) {
      if (!tb.head.includes('Source')) continue;
      const idCol = tb.head.includes('Id') ? 'Id' : tb.head[0];
      for (const r of tb.rows) {
        for (const m of (r.Source || '').matchAll(/knowledge\/([\w./-]+\.md)/g)) {
          const k = m[1];
          if (!backlinks.has(k)) backlinks.set(k, new Set());
          backlinks.get(k).add(stripCode(r[idCol]));
        }
      }
    }
  }
} else warn('KD-4', `agentic-sdlc root not found at ${sdlcRoot}; Used by not checked`);

// ---- KB-2 deny-list ------------------------------------------------------------------------------
const deny = [];
if (exists(companiesRoot)) {
  for (const co of fs.readdirSync(companiesRoot, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    deny.push(co.name);
    const repos = path.join(companiesRoot, co.name, 'repos');
    if (exists(repos)) for (const r of fs.readdirSync(repos, { withFileTypes: true }).filter((e) => e.isDirectory())) deny.push(r.name);
  }
}
const denyRe = deny.length ? new RegExp(`\\b(${deny.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i') : null;

// ---- per-doc checks -----------------------------------------------------------------------------
const urls = new Map(); // url -> first file
const fences = new Map(); // normalized fenced block -> [files]
for (const [f, { fm, text }] of docs) {
  const b = body(text);
  const heads = h2s(b);
  if (denyRe) { const m = b.match(denyRe); if (m) fail('KB-2', `${rel(f)}: company-specific name "${m[1]}" in store B`); }
  for (const m of stripFences(b).matchAll(/\]\((https?:\/\/[^)\s]+)\)|<(https?:\/\/[^>\s]+)>|(?:^|\s)(https?:\/\/[^\s)>|`]+)/g)) {
    const u = (m[1] || m[2] || m[3]).replace(/[.,;]+$/, '');
    if (!urls.has(u)) urls.set(u, f);
  }
  if (!/^# \S/m.test(stripFences(b))) fail('KB-11', `${rel(f)}: no "# Title"`);
  checkKeys(f, fm);
  // KB-7 (warn): conversation residue, outside code and quoted material
  const prose = stripFences(b).split('\n').filter((l) => !/^\s*>/.test(l)).join('\n');
  for (const [re, why] of RESIDUE) { const m = prose.match(re); if (m) warn('KB-7', `${rel(f)}: "${m[0]}" — ${why}`); }
  // KB-8 (warn): the same paragraph twice in one doc. Heading lines are dropped first, so a paragraph
  // written directly under its heading is compared too.
  const seenPara = new Set();
  for (const para of stripFences(b).replace(/^#{1,6} .*$/gm, '').split(/\n\s*\n/).map((x) => x.trim().replace(/\s+/g, ' '))) {
    if (para.length < 120 || /^(\||#|- \[\^)/.test(para)) continue;
    if (seenPara.has(para)) warn('KB-8', `${rel(f)}: paragraph repeated: "${para.slice(0, 70)}…"`);
    seenPara.add(para);
  }
  // KB-8 (warn): collect fenced blocks of 5+ lines for the cross-doc duplicate check below
  for (const m of b.matchAll(/^(`{3,})[^\n]*\n([\s\S]*?)^\1\s*$/gm)) {
    const code = m[2].split('\n').map((l) => l.trimEnd()).filter((l) => l.trim()).join('\n');
    if (code.split('\n').length < 5) continue;
    if (!fences.has(code)) fences.set(code, []);
    fences.get(code).push(rel(f));
  }

  if (fm.schema === 'knowledge-doc/v1') {
    checkCommonFrontMatter(f, fm, 'knowledge-doc');
    if (!TYPES[fm.type]) { fail('KB-9', `${rel(f)}: type "${fm.type}" not one of ${Object.keys(TYPES).join('|')}`); continue; }
    checkSequence(f, heads, [['Summary', 1], ...TYPES[fm.type], ...TAIL.map((n) => [n, 1])]);
    checkSummary(f, text, false);
    checkTail(f, text, fm);
    // KD-6
    if (fm.type === 'concept' && text.split('\n').length > 400) warn('KD-6', `${rel(f)}: ${text.split('\n').length} lines (> ~400); split or move to a deep dive`);
    // KD-9 counts (warn): claim markers outside fenced code blocks, which only quote text
    const vs = section(text, 'Verification status') ?? '';
    const claimText = stripFences(b).replace(vs, '').replace(section(text, 'References') ?? '', '');
    const nOk = (claimText.match(/✅/g) || []).length; const nNo = (claimText.match(/⚠️\s*unverified/g) || []).length;
    const sm = vs.match(/Verified:\s*(\d+)[^·]*·\s*Unverified:\s*(\d+)/);
    const exact = vs.match(/^- Verified: (\d+) (claims?) \(✅\) · Unverified: (\d+) (claims?) \(⚠️\) · Last verified: (\S+?)\.?\s*$/m);
    if (!sm) fail('KD-9', `${rel(f)}: Verification status line missing ("- Verified: n claims (✅) · Unverified: n claims (⚠️) · Last verified: date")`);
    else {
      if (+sm[1] !== nOk || +sm[2] !== nNo) warn('KD-9', `${rel(f)}: Verification status says ${sm[1]} ✅ / ${sm[2]} ⚠️ but body has ${nOk} / ${nNo}`);
      if (!exact) fail('KD-9', `${rel(f)}: Verification status line must read exactly "- Verified: n claims (✅) · Unverified: n claims (⚠️) · Last verified: YYYY-MM-DD"`);
      else {
        const noun = (n) => (+n === 1 ? 'claim' : 'claims');
        if (exact[2] !== noun(exact[1]) || exact[4] !== noun(exact[3])) fail('KD-9', `${rel(f)}: write "${exact[1]} ${noun(exact[1])}" and "${exact[3]} ${noun(exact[3])}"`);
        if (fm['last-verified'] && exact[5] !== fm['last-verified']) fail('KD-9', `${rel(f)}: Verification status says last verified ${exact[5]}, front-matter says ${fm['last-verified']}`);
      }
    }
    // KD-4
    const me = rel(f);
    const actual = backlinks.get(me) ?? new Set();
    const ub = section(text, 'Used by') ?? '';
    const listed = new Set(tables(ub).flatMap((tb) => tb.rows.map((r) => stripCode(r['Id / path'] ?? Object.values(r)[1] ?? ''))).filter(Boolean));
    if (!listed.size && !/_Not cited by any rule yet\._/.test(ub)) fail('KD-4', `${me}: Used by has no table and no "_Not cited by any rule yet._"`);
    for (const id of actual) if (!listed.has(id)) fail('KD-4', `${me}: cited by ${id} (Source) but not listed in Used by`);
    for (const id of listed) if (!actual.has(id) && /^[A-Z][\w-]*-R?\d+$/.test(id)) fail('KD-4', `${me}: Used by lists ${id}, but that rule's Source does not cite this doc`);
    // KD-7
    for (const d of [].concat(fm['derived-from'] ?? [])) {
      const p = path.join(kRoot, String(d));
      if (!exists(p)) { fail('KD-7', `${me}: derived-from ${d} does not exist`); continue; }
      const src = docs.get(p);
      if (src?.fm.schema === 'deep-dive/v1' && !(src.fm['synthesized-into'] ?? []).some((e) => (e?.path ?? e) === me)) fail('KD-7', `${me}: derived-from ${d}, but its synthesized-into does not list this doc`);
    }
  } else if (fm.schema === 'deep-dive/v1') {
    checkCommonFrontMatter(f, fm, 'deep-dive');
    if (!Array.isArray(fm['synthesized-into'])) fail('DD-1', `${rel(f)}: front-matter "synthesized-into" missing (use [] until synthesized)`);
    if (heads[0] !== 'Summary') fail('DD-1', `${rel(f)}: first section must be "## Summary"`);
    if (heads.slice(-2).join('|') !== 'References|Related') fail('DD-1', `${rel(f)}: last sections must be "## References", "## Related"`);
    checkSummary(f, text, true);
    checkTail(f, text, fm);
    for (const e of fm['synthesized-into'] ?? []) {
      const p = path.join(kRoot, String(e?.path ?? e));
      const d = docs.get(p);
      if (!exists(p)) { fail('DD-3', `${rel(f)}: synthesized-into ${e?.path ?? e} does not exist`); continue; }
      if (![].concat(d?.fm['derived-from'] ?? []).includes(rel(f))) fail('DD-3', `${rel(f)}: ${e?.path ?? e} has no derived-from pointing back here`);
      if (e?.on && fm['last-updated'] > e.on) warn('DD-4', `${rel(f)}: updated ${fm['last-updated']} after synthesis into ${e.path} (${e.on}); re-synthesize`);
    }
  } else if (fm.schema === 'topic-index/v1') {
    const isRoot = path.dirname(f) === kRoot;
    if (path.basename(f) !== 'index.md') { fail('TI-1', `${rel(f)}: topic-index/v1 must be named index.md`); continue; }
    const kind = fm.kind;
    if (!['root', 'topic', 'subtopic'].includes(kind)) fail('TI-1', `${rel(f)}: kind "${kind}" not root|topic|subtopic`);
    if (isRoot !== (kind === 'root')) fail('TI-1', `${rel(f)}: kind ${kind} does not match location`);
    if (!isRoot && fm.topic !== rel(path.dirname(f))) fail('TI-1', `${rel(f)}: topic "${fm.topic}" ≠ folder path "${rel(path.dirname(f))}"`);
    if (!fm['last-updated']) fail('TI-1', `${rel(f)}: last-updated missing`);
    if (heads.slice(-2).join('|') !== 'References|Related') fail('TI-2', `${rel(f)}: must end with "## References", "## Related"`);
    const dir = path.dirname(f);
    if (kind === 'root') {
      const tb = tables(section(text, 'Topics') ?? '').flatMap((x) => x.rows);
      if (section(text, 'Topics') === null) fail('TI-3', `${rel(f)}: root index needs "## Topics"`);
      const listed = new Set(tb.map((r) => linkTarget(r.Topic ?? '').replace(/\/?(index\.md)?$/, '')));
      for (const d of fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.'))) {
        if (!listed.has(d.name)) fail('TI-3', `${rel(f)}: topic folder "${d.name}" not listed in Topics`);
      }
      for (const t of listed) if (t && !exists(path.join(dir, t))) fail('TI-3', `${rel(f)}: Topics lists "${t}", which does not exist`);
    } else {
      if (section(text, 'Docs') === null) fail('TI-4', `${rel(f)}: "## Docs" missing`);
      const rows = tables(section(text, 'Docs') ?? '').flatMap((x) => x.rows);
      const seen = new Map();
      for (const r of rows) {
        const target = linkTarget(r.Doc ?? '');
        if (!target || target === '—') continue;
        const p = path.join(dir, target);
        if (!exists(p)) { fail('TI-4', `${rel(f)}: Docs lists ${target}, which does not exist`); continue; }
        if (seen.has(p)) fail('TI-4', `${rel(f)}: ${target} listed twice`);
        seen.set(p, r);
        const d = docs.get(p);
        if (!d) { if (stripCode(r.Type) !== 'legacy') fail('TI-5', `${rel(f)}: ${target} is a legacy doc; Type must be "legacy"`); continue; }
        const want = d.fm.schema === 'deep-dive/v1' ? 'deep-dive' : d.fm.type;
        if (stripCode(r.Type) !== want) fail('TI-5', `${rel(f)}: ${target} Type "${r.Type}" ≠ "${want}"`);
        if (stripCode(r.Status) !== d.fm.status) fail('TI-5', `${rel(f)}: ${target} Status "${r.Status}" ≠ "${d.fm.status}"`);
      }
      for (const [p, d] of docs) {
        if (path.dirname(p) === dir && d.fm.schema !== 'topic-index/v1' && !seen.has(p)) fail('TI-4', `${rel(f)}: v1 doc ${path.basename(p)} has no Docs row`);
      }
      const subs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.'));
      if (subs.length) {
        // A subtopic may not have subfolders at all, so asking it to list them would contradict the first message.
        if (kind === 'subtopic') fail('TI-6', `${rel(f)}: subfolders nest at most one level deep`);
        else {
          const st = tables(section(text, 'Subtopics') ?? '').flatMap((x) => x.rows).map((r) => linkTarget(r.Subtopic ?? '').replace(/\/?(index\.md)?$/, ''));
          for (const s of subs) if (!st.includes(s.name)) fail('TI-6', `${rel(f)}: subfolder "${s.name}" not listed in Subtopics`);
        }
      }
    }
  }
}

// KB-8 (warn): the same fenced block (5+ lines) in more than one place — link to one canonical copy instead
for (const [code, files] of fences) if (files.length > 1) warn('KB-8', `identical ${code.split('\n').length}-line block in ${files.join(', ')}; keep one copy and link to it`);

// index.md required wherever a v1 doc lives, up to the root
for (const f of docs.keys()) {
  if (path.basename(f) === 'index.md') continue;
  for (let d = path.dirname(f); ; d = path.dirname(d)) {
    const idx = path.join(d, 'index.md');
    if (!docs.has(idx) || docs.get(idx).fm.schema !== 'topic-index/v1') fail('TI-7', `${rel(d) || '.'}/index.md (topic-index/v1) is required: folder holds or contains v1 docs`);
    if (d === kRoot || !d.startsWith(kRoot)) break;
  }
}

// ---- KB-3 (optional, network) ------------------------------------------------------------------
if (checkUrls) {
  const list = [...urls];
  const probe = async ([u, f]) => {
    for (const method of ['HEAD', 'GET']) {
      try {
        const res = await fetch(u, { method, redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 validate-knowledge' } });
        if (res.status < 400) return;
        if (method === 'GET') (res.status === 403 || res.status === 429 ? warn : fail)('KB-3', `${rel(f)}: ${u} → HTTP ${res.status}`);
      } catch (e) { if (method === 'GET') warn('KB-3', `${rel(f)}: ${u} → ${e.name}: ${e.message}`); }
    }
  };
  for (let i = 0; i < list.length; i += 8) await Promise.all(list.slice(i, i + 8).map(probe));
}

// dedupe (the index-required check can repeat per doc)
const uniq = (a) => [...new Set(a)];
const F = uniq(fails); const W = uniq(warns);
const counts = { 'knowledge-doc/v1': 0, 'deep-dive/v1': 0, 'topic-index/v1': 0 };
for (const { fm } of docs.values()) counts[fm.schema]++;
console.log(`knowledge validate: ${counts['knowledge-doc/v1']} docs, ${counts['deep-dive/v1']} deep dives, ${counts['topic-index/v1']} indexes, ${backlinks.size} cited docs${checkUrls ? `, ${urls.size} URLs probed` : ''} (legacy docs skipped) — ${today}`);
for (const w of W) console.log(w);
if (F.length) { console.log(`FAIL (${F.length})`); for (const x of F) console.log(x); process.exit(1); }
console.log(`PASS (${W.length} warning(s))`);
