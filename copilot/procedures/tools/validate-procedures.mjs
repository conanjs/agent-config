#!/usr/bin/env node
// validate-procedures.mjs — checks copilot/procedures/**/*.procedure.md against procedure.schema.md.
//
// Usage: node validate-procedures.mjs [procedures-root] [--max-age <days>] [--upstream]
//   procedures-root  default: <this tool>/..  (repo: copilot/procedures, installed: ~/.copilot/procedures)
//   --max-age        days before a verified dependency counts as due for re-verification (default 90)
//   --upstream       also ask GitHub for the latest release of every dependency with a `repo:` and warn when it
//                    differs from `verified-against` (network; uses GITHUB_TOKEN when set)
//
// Checks: PR-1 front-matter (schema, keys, dates); PR-2 depends-on entries; PR-3 required sections and order;
// PR-4 freshness (warn): unverified dependencies, last-verified older than --max-age; PR-5 upstream drift (warn).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const upstream = args.includes('--upstream'); if (upstream) args.splice(args.indexOf('--upstream'), 1);
const maxAge = Number(flag('--max-age') ?? 90);
const here = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const pRoot = fs.realpathSync(path.resolve(args[0] ?? path.join(here, '..')));

const fails = []; const warns = [];
const fail = (code, msg) => fails.push(`  ${code}  ${msg}`);
const warn = (code, msg) => warns.push(`  warn  ${code}  ${msg}`);
const read = (p) => fs.readFileSync(p, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
const rel = (p) => path.relative(pRoot, p).split(path.sep).join('/');
const today = new Date().toISOString().slice(0, 10);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEYS = ['schema', 'last-updated', 'last-verified', 'depends-on'];
const DEP_KEYS = ['tool', 'verified-against', 'source', 'repo'];

// ---- tiny YAML front-matter parser (scalars, [inline], block lists of maps) — same subset as validate-knowledge.mjs
function scalar(v) {
  v = v.trim();
  if (!/^["']/.test(v)) v = v.replace(/\s+#.*$/, '');
  if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map((s) => scalar(s)).filter((s) => s !== '');
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
    const item = line.match(/^\s*-\s+([\w-]+):\s*(.*)$/);
    if (item && key) { if (!Array.isArray(fm[key])) fm[key] = []; fm[key].push({ [item[1]]: scalar(item[2]) }); continue; }
    const cont = line.match(/^\s+([\w-]+):\s*(.*)$/);
    if (cont && key && Array.isArray(fm[key]) && typeof fm[key].at(-1) === 'object') fm[key].at(-1)[cont[1]] = scalar(cont[2]);
  }
  return fm;
}
const stripFences = (t) => t.replace(/^(`{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
const daysSince = (d) => Math.floor((Date.parse(today) - Date.parse(d)) / 86400000);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'tools') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.procedure.md')) out.push(p);
  }
  return out;
}

const files = walk(pRoot);
const drift = []; // [file, dep] for --upstream
for (const f of files) {
  const text = read(f); const fm = frontMatter(text);
  // PR-1
  if (!fm) { fail('PR-1', `${rel(f)}: no front-matter (needs schema: procedure/v1)`); continue; }
  if (fm.schema !== 'procedure/v1') fail('PR-1', `${rel(f)}: schema must be procedure/v1`);
  for (const k of Object.keys(fm)) if (!KEYS.includes(k)) fail('PR-1', `${rel(f)}: front-matter key "${k}" is not defined (allowed: ${KEYS.join(', ')})`);
  if (!DATE.test(fm['last-updated'] ?? '')) fail('PR-1', `${rel(f)}: last-updated must be YYYY-MM-DD`);
  if (fm['last-verified'] !== undefined && !DATE.test(fm['last-verified'])) fail('PR-1', `${rel(f)}: last-verified must be YYYY-MM-DD`);
  // PR-2
  const deps = fm['depends-on'];
  if (!Array.isArray(deps)) { fail('PR-2', `${rel(f)}: depends-on missing (use [] when the procedure states no external tool behaviour)`); continue; }
  let anyVerified = false;
  for (const d of deps) {
    const name = d.tool ?? '(no tool)';
    for (const k of Object.keys(d)) if (!DEP_KEYS.includes(k)) fail('PR-2', `${rel(f)}: depends-on ${name}: unknown key "${k}"`);
    for (const k of ['tool', 'verified-against', 'source']) if (!d[k]) fail('PR-2', `${rel(f)}: depends-on ${name}: "${k}" missing`);
    if (d.source && !/^https?:\/\//.test(d.source)) fail('PR-2', `${rel(f)}: depends-on ${name}: source must be a URL`);
    if (d.repo && !/^[\w.-]+\/[\w.-]+$/.test(d.repo)) fail('PR-2', `${rel(f)}: depends-on ${name}: repo must be owner/name`);
    if (d['verified-against'] === 'unverified') warn('PR-4', `${rel(f)}: ${name} has never been verified against its source; verify and record the version`);
    else if (d['verified-against']) { anyVerified = true; if (d.repo) drift.push([f, d]); }
  }
  if (anyVerified && !fm['last-verified']) fail('PR-2', `${rel(f)}: a dependency has verified-against set, so last-verified is required`);
  // PR-4
  if (anyVerified && DATE.test(fm['last-verified'] ?? '') && daysSince(fm['last-verified']) > maxAge) warn('PR-4', `${rel(f)}: last verified ${fm['last-verified']} (${daysSince(fm['last-verified'])} days ago, > ${maxAge}); re-check every depends-on source`);
  // PR-3
  const body = stripFences(text.replace(/^---\n[\s\S]*?\n---\n/, ''));
  if (!/^# Procedure: \S/m.test(body)) fail('PR-3', `${rel(f)}: title must be "# Procedure: <name>"`);
  const heads = [...body.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);
  const order = ['Steps', 'References', 'Related'].map((h) => heads.indexOf(h));
  if (order.includes(-1)) fail('PR-3', `${rel(f)}: needs sections "## Steps", "## References", "## Related" (has: ${heads.join(', ')})`);
  else if (!(order[0] < order[1] && order[1] < order[2]) || heads.at(-1) !== 'Related') fail('PR-3', `${rel(f)}: order must be Steps … References → Related, with Related last`);
  if (deps.length && !/https?:\/\//.test(body.slice(body.search(/^## References/m)))) fail('PR-3', `${rel(f)}: depends-on is not empty, so References needs the external sources`);
}

// ---- PR-5 (optional, network) ------------------------------------------------------------------
if (upstream) {
  const headers = { 'user-agent': 'validate-procedures', accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
  const norm = (v) => String(v).replace(/^v/, '');
  for (const [f, d] of drift) {
    try {
      const res = await fetch(`https://api.github.com/repos/${d.repo}/releases/latest`, { headers, signal: AbortSignal.timeout(15000) });
      if (!res.ok) { warn('PR-5', `${rel(f)}: ${d.repo} latest release → HTTP ${res.status}`); continue; }
      const tag = (await res.json()).tag_name;
      if (norm(tag) !== norm(d['verified-against'])) warn('PR-5', `${rel(f)}: ${d.tool} verified against ${d['verified-against']}, upstream latest is ${tag}; re-verify the procedure`);
    } catch (e) { warn('PR-5', `${rel(f)}: ${d.repo} → ${e.name}: ${e.message}`); }
  }
}

console.log(`procedures validate: ${files.length} procedures${upstream ? `, ${drift.length} upstream versions checked` : ''} — ${today}`);
for (const w of warns) console.log(w);
if (fails.length) { console.log(`FAIL (${fails.length})`); for (const x of fails) console.log(x); process.exit(1); }
console.log(`PASS (${warns.length} warning(s))`);
