#!/usr/bin/env node
// efficiency-audit.mjs — finds token-wasting patterns in the session logs Claude Code, Codex and GitHub Copilot already
// write, and reports them per session and per week (efficiency-audit/v1, efficiency-audit.schema.md). Read-only on
// the logs, no network, no model calls, no dependencies (proposals/efficiency-auditor.md, approved 2026-11-10).
//
// Usage:
//   efficiency-audit.mjs session <session id, id prefix or log path> [--json]
//   efficiency-audit.mjs week [--week <any date in the week>] [--json] [--tracker <repo folder>]
//   efficiency-audit.mjs check-triggers
// Folders: $CLAUDE_CONFIG_DIR or ~/.claude, $CODEX_HOME or ~/.codex, $COPILOT_HOME or ~/.copilot.
// The weekly history: $COPILOT_HOME/efficiency-audit/history.jsonl. EFFICIENCY_AUDIT_NOW pins "now" (tests).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { anthropic, codex as codexRates, codexFastTiers } from '../hooks/turn-tokens/prices.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const now = () => new Date(process.env.EFFICIENCY_AUDIT_NOW ?? Date.now());
const HOME = os.homedir();
const home = {
  claude: process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude'),
  codex: process.env.CODEX_HOME || path.join(HOME, '.codex'),
  copilot: process.env.COPILOT_HOME || path.join(HOME, '.copilot'),
};
const NAME = { claude: 'Claude Code', codex: 'Codex', copilot: 'Copilot' };
const UNIT = { claude: 'usd', codex: 'credits', copilot: 'ai-credits' };

// ---- thresholds (section 5 of the proposal; change only together with a scenario) ---------------------------
const T = {
  serialRun: 3, // EA-1: single-read requests in a row
  startRequests: 3, // EA-2: first requests of the first turn
  bigOutput: 40_000, // EA-4: characters of one tool output
  dupReads: 3, // EA-5: duplicate full reads in one session
  rebuildContext: 50_000, // EA-6: context of a rebuilding request
  cacheTtlMin: { claude: 60, codex: 5, copilot: 5 }, // EA-6a: cache lifetime when the log does not say
  peak: 200_000, // EA-7
  nearWindow: 0.8, // EA-7
  manyRequests: 10, // EA-9
  shortAnswer: 600, // EA-9: characters of the final answer
  bigSearch: 20_000, // EA-10
  outlierFactor: 2, // AU-6: weekly rate against the 4-week median
  outlierMin: 5, // AU-6: findings needed for a flag
  trackerMax: 3, // AU-7
};

const DETECTORS = {
  'EA-1': 'one file per request',
  'EA-2': 'instruction file read at session start',
  'EA-3': 'reference read with its trigger false',
  'EA-4': 'very large tool output',
  'EA-5': 'same file read in full again',
  'EA-6a': 'cache rebuilt after a pause',
  'EA-6b': 'cache rebuilt without a pause',
  'EA-7': 'large context or compaction',
  'EA-8': 'subagents cost more than the main agent',
  'EA-9': 'many requests for a short answer (experimental)',
  'EA-10': 'large unscoped search',
};
const FIX = {
  'EA-1': 'plan the reads and request them together (core line IW-13); if this agent keeps doing it, test a stronger wording',
  'EA-2': 'remove the pointer: the agent loads this file by itself (instruction-loading D2)',
  'EA-3': 'key the trigger to something visible in the message or session (IW-7 → IW-12)',
  'EA-4': 'read a range, search first, split the doc, or filter the output',
  'EA-5': 'keep the facts from the first read; read only the range needed',
  'EA-6a': 'before a break, finish or compact; start a new session for a new task',
  'EA-6b': 'pick the model, effort and MCP servers at session start',
  'EA-7': 'clear or compact at task boundaries; one session per task',
  'EA-8': 'check the delegation was needed; use a cheaper subagent model',
  'EA-9': 'answer from what is known, or ask one focused question',
  'EA-10': 'scope the search to a folder, glob or file type; ignore generated folders',
};
const RECORD_IN = {
  'EA-1': 'copilot/knowledge/ai-agents/instruction-wording-findings.md',
  'EA-2': 'copilot/knowledge/ai-agents/instruction-wording-findings.md',
  'EA-3': 'copilot/knowledge/ai-agents/instruction-wording-findings.md',
  'EA-6a': { claude: 'copilot/knowledge/ai-agents/claude-code-usage-reference.md', codex: 'copilot/knowledge/ai-agents/codex-usage-reference.md', copilot: 'copilot/knowledge/ai-agents/copilot-usage-reference.md' },
  default: 'copilot/knowledge/ai-agents/agent-token-accounting.md',
};

// ---- small helpers -----------------------------------------------------------------------------------------------
const n = (x) => Math.round(x).toLocaleString('en-US');
const tilde = (p) => (p && p.startsWith(HOME + '/') ? '~' + p.slice(HOME.length) : p);
const short = (s, max = 80) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
const plural = (k, w) => `${n(k)} ${w}${k === 1 ? '' : 's'}`;
const isTemp = (cwd) => /^(\/private)?\/tmp\/|^\/var\/folders\//.test(cwd || '') || (os.tmpdir() && cwd?.startsWith(os.tmpdir()));
const textLen = (c) => (c == null ? 0 : typeof c === 'string' ? c.length : Array.isArray(c) ? c.reduce((k, b) => k + (typeof b === 'string' ? b.length : typeof b?.text === 'string' ? b.text.length : JSON.stringify(b ?? '').length), 0) : typeof c.content === 'string' ? c.content.length : JSON.stringify(c).length);
const textOf = (c) => (c == null ? '' : typeof c === 'string' ? c : Array.isArray(c) ? c.map((b) => (typeof b === 'string' ? b : b?.text ?? '')).join('\n') : typeof c.content === 'string' ? c.content : JSON.stringify(c));
function money(v, unit) {
  if (unit === 'usd') return `≈ $${v < 1 ? v.toFixed(3) : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${unit === 'credits' ? 'credits' : 'AI credits'}`;
}
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantile = (xs, q) => { if (xs.length < 10) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };
const weekStart = (d) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t; };
const day = (d) => d.toISOString().slice(0, 10);

/** Each line of a JSON Lines file, parsed; a line that is not JSON adds to `skipped` (AU-1). */
function readLines(file, skipped) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { skipped.files++; return []; }
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { skipped.lines++; }
  }
  return out;
}
function walk(dir, test, out = []) {
  let es;
  try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of es) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, test, out); else if (test(p)) out.push(p); }
  return out;
}

// ---- what a tool call read, edited or searched --------------------------------------------------------------------
const READ_CMD = /^(cat|head|tail|nl|less|sed\s+-n\s+(?:'[^']*'|"[^"]*"|\S+))\s+(.+)$/;
/** Files a shell command only reads (cat, head, tail, nl, less, sed -n); `partial` unless the whole file is printed. */
function shellReads(cmd = '') {
  const out = [];
  for (const seg of String(cmd).split(/&&|;|\|\||\n/)) {
    const m = seg.trim().replace(/^cd\s+\S+\s*$/, '').match(READ_CMD);
    if (!m) continue;
    const partial = !/^(cat|nl|less)$/.test(m[1]) || /\|/.test(m[2]);
    for (const tok of m[2].split(/\s+/)) {
      if (/^\|/.test(tok)) break;
      if (!tok || tok.startsWith('-') || /^\d+$/.test(tok) || /^[<>&]|^\d?>|^\/dev\//.test(tok)) continue;
      const p = tok.replace(/^['"]|['"]$/g, '');
      if (p.includes('/') || p.includes('.')) out.push({ path: p, partial });
    }
  }
  return out;
}
const SEARCH_CMD = /(^|[\s;&|(])(rg|grep\s+-[a-zA-Z]*[rR][a-zA-Z]*|find)\s/;
const SCOPED = /\s(-g|--glob|--include|--type|-t|--iglob|-name|-iname)[\s=]/;
const isUnscopedShellSearch = (cmd = '') => SEARCH_CMD.test(cmd) && !SCOPED.test(cmd);
// A shell command that may change files in ways the auditor cannot follow: EA-5 forgets earlier full reads.
const MUTATES = /\bsed\s+-i|\bperl\s+-[a-z]*i|\btee\b|[^<>2&]>\s*[^&\s>]|\bgit\s+(checkout|restore|apply|stash|pull|merge|rebase|reset|switch)\b|\b(npm|pnpm|yarn|npx)\s|--write\b|--fix\b|\bmv\s|\bcp\s/;
const patchPaths = (s = '') => [...String(s).matchAll(/\*\*\* (?:Add|Update|Delete) File: ([^\n\\"]+)/g)].map((m) => m[1].trim());
const resolve = (p, cwd) => (!p ? p : p.startsWith('~/') ? path.join(HOME, p.slice(2)) : path.isAbsolute(p) ? p : path.join(cwd || '/', p));

function addShellReads(t, cmd, cwd) {
  for (const r of shellReads(cmd)) { const p = resolve(r.path, cwd); t.reads.push(p); if (!r.partial) t.full.push(p); }
}

/** One tool call in the common shape (section 4 of the proposal). */
function toolCall(name, input, cwd) {
  const t = { name, reads: [], full: [], edits: [], search: false, cmd: '', outChars: 0, outText: '' };
  const i = input && typeof input === 'object' ? input : {};
  if (['Read', 'NotebookRead', 'view', 'read_file'].includes(name)) {
    const p = i.file_path ?? i.path;
    if (p) t.reads.push(resolve(p, cwd));
    if (p && i.offset == null && i.limit == null && i.view_range == null) t.full.push(resolve(p, cwd));
  } else if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'edit', 'create', 'str_replace', 'write'].includes(name)) {
    const p = i.file_path ?? i.path ?? i.notebook_path;
    if (p) t.edits.push(resolve(p, cwd));
  } else if (['Bash', 'bash'].includes(name)) {
    t.cmd = String(i.command ?? '');
    addShellReads(t, t.cmd, cwd);
    t.search = isUnscopedShellSearch(t.cmd);
    t.mutates = MUTATES.test(t.cmd);
  } else if (['Grep', 'Glob', 'grep', 'glob', 'rg'].includes(name)) {
    t.cmd = `${name} ${i.pattern ?? ''}`;
    t.search = !i.path && !i.glob && !i.type && !i.include;
  } else if (name === 'apply_patch') {
    t.edits.push(...patchPaths(typeof input === 'string' ? input : i.input ?? i.patch).map((p) => resolve(p, cwd)));
  }
  return t;
}

/** A Codex `exec` or shell call: one or more commands, so one call can be a batch of reads. */
function codexCall(p, cwd) {
  const name = p.namespace ? `${p.namespace}.${p.name}` : p.name;
  const raw = String(p.arguments ?? p.input ?? '');
  const t = { name, reads: [], full: [], edits: patchPaths(raw).map((x) => resolve(x, cwd)), search: false, cmd: '', outChars: 0, outText: '', commands: 0 };
  const cmds = [];
  try {
    const a = JSON.parse(raw);
    for (const k of ['cmd', 'command']) if (a?.[k]) cmds.push(Array.isArray(a[k]) ? a[k].join(' ') : String(a[k]));
  } catch {
    for (const m of raw.matchAll(/\bcmd\s*:\s*"((?:[^"\\]|\\.)*)"/g)) cmds.push(m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'));
  }
  t.commands = cmds.length;
  t.cmd = cmds.join(' ; ');
  for (const c of cmds) { addShellReads(t, c, cwd); if (MUTATES.test(c)) t.mutates = true; }
  t.search = cmds.length === 1 && isUnscopedShellSearch(cmds[0]); // a call that also runs other commands: its output is not the search's
  return t;
}

// ---- prices ------------------------------------------------------------------------------------------------------
function claudeCost(model, u) { // list-price estimate at standard speed, in dollars
  const p = anthropic[String(model ?? '').replace(/\[1m\]$/i, '').replace(/-\d{8}$/, '')];
  if (!p) return 0;
  const oneHour = Math.min(u.oneHour, u.cw);
  return (u.newInput * p.input + (u.cw - oneHour) * p.write5m + oneHour * p.write1h + u.cr * p.read + u.out * p.output) / 1e12;
}
function codexCost(model, u, tier) { // credits at Standard rates; 2× for a fast tier
  const r = codexRates[model];
  if (!r) return 0;
  const k = (u.newInput * r.input + u.cr * r.cached + u.out * r.output) / 1e9;
  return codexFastTiers.includes(tier) ? 2 * k : k;
}

// ---- readers: each tool's log → Session { tool, id, cwd, scripted, window, turns[] } -------------------------------
const newTurn = (prompt, at) => ({ prompt, at, requests: [], compactions: [] });
const newRequest = (at, ctx, cw, cr, out, cost) => ({ at, ctx, cw, cr, out, cost, tools: [], text: 0, expires: null, afterCompaction: false });

function readClaude(file, skipped) {
  const lines = readLines(file, skipped);
  const s = { tool: 'claude', id: path.basename(file, '.jsonl'), file, cwd: '', model: '', turns: [], window: 200_000 };
  let turn = null; let compactedSinceLast = false;
  const seen = new Map(); const byId = new Map();
  for (const e of lines) {
    if (e.cwd && !s.cwd) s.cwd = e.cwd;
    if (e.type === 'system' && e.subtype === 'compact_boundary') {
      const c = e.compactMetadata || {};
      if (turn) turn.compactions.push({ pre: c.preTokens || 0, post: c.postTokens || 0 });
      compactedSinceLast = true;
      continue;
    }
    if (e.type === 'user') {
      const c = e.message?.content;
      if (Array.isArray(c) && c.some((b) => b?.type === 'tool_result')) {
        for (const b of c) if (b?.type === 'tool_result') { const t = byId.get(b.tool_use_id); if (t) { t.outChars = textLen(b.content); t.outText = textOf(b.content); } }
        continue;
      }
      if (e.isMeta || e.isCompactSummary) continue;
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text).join('\n') : '';
      if (/^<local-command/.test(text.trim())) continue;
      turn = newTurn(text, e.timestamp); s.turns.push(turn);
      continue;
    }
    if (e.type !== 'assistant' || !turn) continue;
    const m = e.message || {};
    if (!m.usage || m.model === '<synthetic>') continue;
    const key = `${m.id}|${e.requestId}`;
    let r = seen.get(key);
    if (!r) {
      const u = m.usage;
      const use = { newInput: u.input_tokens || 0, cw: u.cache_creation_input_tokens || 0, cr: u.cache_read_input_tokens || 0, out: u.output_tokens || 0, oneHour: u.cache_creation?.ephemeral_1h_input_tokens || 0 };
      r = newRequest(e.timestamp, use.newInput + use.cw + use.cr, use.cw, use.cr, use.out, claudeCost(m.model, use));
      r.afterCompaction = compactedSinceLast; compactedSinceLast = false;
      seen.set(key, r); turn.requests.push(r);
      if (m.model) s.model = m.model;
    }
    for (const b of m.content || []) {
      if (b?.type === 'text') r.text += b.text.length;
      if (b?.type === 'tool_use' || b?.type === 'server_tool_use') { const t = toolCall(b.name, b.input, s.cwd); r.tools.push(t); byId.set(b.id, t); }
    }
  }
  if (/^claude-(opus|sonnet)-5|\[1m\]/.test(s.model)) s.window = 1_000_000;
  s.scripted = isTemp(s.cwd);
  return s;
}

const CODEX_NOT_PROMPT = /^\s*(<environment_context|<user_instructions|<permissions|<turn_aborted|# AGENTS\.md)/;
function readCodex(file, skipped) {
  const lines = readLines(file, skipped);
  const s = { tool: 'codex', id: path.basename(file, '.jsonl').replace(/^rollout-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-/, ''), file, cwd: '', turns: [], window: 258_400, scripted: false, subagent: false };
  let turn = null; let model = ''; let tier = ''; let pending = []; let compactedSinceLast = false;
  const byCall = new Map();
  for (const e of lines) {
    const p = e.payload || {};
    if (e.type === 'session_meta') {
      s.id = p.id || s.id; s.cwd = p.cwd || s.cwd;
      if (p.originator === 'codex_exec') s.scripted = true;
      if (p.source?.subagent || p.thread_source === 'subagent') s.subagent = true;
    } else if (e.type === 'turn_context') { model = p.model || model; tier = p.service_tier || tier; }
    else if (e.type === 'compacted') { if (turn) turn.compactions.push({ pre: 0, post: 0 }); compactedSinceLast = true; }
    else if (e.type === 'event_msg' && p.type === 'token_count' && p.info?.model_context_window) s.window = p.info.model_context_window;
    else if (e.type === 'response_item' && p.type === 'message' && p.role === 'user') {
      const text = (p.content || []).map((c) => c.text || '').join('\n');
      if (CODEX_NOT_PROMPT.test(text)) continue;
      turn = newTurn(text, e.timestamp); s.turns.push(turn); pending = [];
    } else if (e.type === 'response_item' && (p.type === 'function_call' || p.type === 'custom_tool_call')) {
      const t = codexCall(p, s.cwd); pending.push(t); byCall.set(p.call_id, t);
    } else if (e.type === 'response_item' && /_call_output$/.test(p.type || '')) {
      const t = byCall.get(p.call_id); if (t) { t.outChars = textLen(p.output); t.outText = textOf(p.output); }
    } else if (e.type === 'response_item' && (p.type === 'message' || p.type === 'agent_message') && p.role === 'assistant' && turn?.requests.length) {
      turn.lastText = textLen((p.content || []).map((c) => c.text || '').join(''));
    } else if (e.type === 'token_usage_record' && turn) {
      const u = p.usage || {};
      const use = { newInput: (u.input_tokens || 0) - (u.cached_input_tokens || 0), cr: u.cached_input_tokens || 0, out: u.output_tokens || 0 };
      const r = newRequest(e.timestamp, u.input_tokens || 0, 0, use.cr, use.out, codexCost(model, use, tier));
      r.afterCompaction = compactedSinceLast; compactedSinceLast = false;
      r.tools.push(...pending); pending = [];
      turn.requests.push(r);
    }
  }
  for (const t of s.turns) if (t.lastText != null && t.requests.length) t.requests.at(-1).text = t.lastText;
  s.scripted = s.scripted || isTemp(s.cwd);
  return s;
}

function readCopilot(file, skipped) {
  const lines = readLines(file, skipped);
  const s = { tool: 'copilot', id: path.basename(path.dirname(file)), file, cwd: '', turns: [], window: 200_000 };
  let turn = null; let last = null; let compactedSinceLast = false;
  const byCall = new Map();
  for (const e of lines) {
    const d = e.data || {};
    if (e.type === 'session.start') { s.id = d.sessionId || s.id; s.cwd = d.context?.cwd || s.cwd; }
    else if (e.type === 'session.compaction_start') { if (turn) turn.compactions.push({ pre: d.currentTokens || 0, post: 0 }); compactedSinceLast = true; }
    else if (e.type === 'user.message') { turn = newTurn(String(d.content ?? ''), e.timestamp); s.turns.push(turn); last = null; }
    else if (!turn) continue;
    else if (e.type === 'session.usage_record') {
      const u = d.usage || {};
      if (u.maxPromptTokens) s.window = u.maxPromptTokens;
      if (u.initiator === 'sub-agent') continue;
      const ctx = u.inputTokens || 0;
      last = newRequest(e.timestamp, ctx, u.cacheWriteTokens || 0, u.cacheReadTokens || 0, u.outputTokens || 0, (u.copilotUsage?.totalNanoAiu || 0) / 1e9);
      last.expires = u.cacheExpiresAt || null;
      last.afterCompaction = compactedSinceLast; compactedSinceLast = false;
      turn.requests.push(last);
    } else if (e.type === 'assistant.message' && last) { last.text += String(d.content ?? '').length; }
    else if (e.type === 'tool.execution_start' && last) { const t = toolCall(d.toolName, d.arguments, s.cwd); last.tools.push(t); byCall.set(d.toolCallId, t); }
    else if (e.type === 'tool.execution_complete') { const t = byCall.get(d.toolCallId); if (t) { const c = d.result?.content ?? d.result; t.outChars = textLen(c); t.outText = textOf(c); } }
  }
  s.scripted = isTemp(s.cwd);
  return s;
}

function sessionFiles() {
  return [
    ...walk(path.join(home.claude, 'projects'), (p) => p.endsWith('.jsonl') && !p.includes(`${path.sep}subagents${path.sep}`)).map((f) => ['claude', f]),
    ...walk(path.join(home.codex, 'sessions'), (p) => /rollout-.*\.jsonl$/.test(p)).map((f) => ['codex', f]),
    ...walk(path.join(home.copilot, 'session-state'), (p) => p.endsWith(`${path.sep}events.jsonl`)).map((f) => ['copilot', f]),
  ];
}
const READERS = { claude: readClaude, codex: readCodex, copilot: readCopilot };
function loadSessions(skipped) {
  const out = [];
  for (const [tool, f] of sessionFiles()) {
    const s = READERS[tool](f, skipped);
    if (!s.subagent && s.turns.some((t) => t.requests.length)) out.push(s);
  }
  return out;
}
function loadHistory(skipped) { // the turn token history (turn-tokens/v1), for EA-8
  const out = [];
  for (const tool of Object.keys(home)) for (const f of walk(path.join(home[tool], 'turn-tokens'), (p) => p.endsWith('.jsonl'))) for (const r of readLines(f, skipped)) if (r.schema === 'turn-tokens/v1') out.push({ ...r, tool });
  return out;
}

// ---- triggers (EA-3, AU-10) --------------------------------------------------------------------------------------
const TRIGGERS = JSON.parse(fs.readFileSync(path.join(here, 'triggers.json'), 'utf8')).triggers;
const triggerKey = (f) => f.replace(/^~\/\.copilot\//, '');
const matchesTrigger = (p, trig) => { const k = triggerKey(trig.file); return p.endsWith(`/.copilot/${k}`) || p.endsWith(`/copilot/${k}`); };
const PATTERN_TAG = /^\s*pattern:(\S+)/i;
const DEEP = /deep dive|thorough|in detail|complete flow explanation|explain all cases/i;
function triggerHolds(trig, s, turn, before) {
  const when = trig.when;
  if (when === 'pattern-tag-or-deep-dive') { const m = turn.prompt.match(PATTERN_TAG); return (m && m[1].toLowerCase() !== 'default') || DEEP.test(turn.prompt); }
  if (when === 'graph-tools') return s.turns.some((t) => t.requests.some((r) => r.tools.some((x) => /code.review.graph/i.test(x.name))));
  if (when === 'placeholder') return turn.prompt.includes('{{') || before.some((x) => x.outText.includes('{{'));
  if (when?.words) { const hay = `${turn.prompt}\n${s.cwd}`.toLowerCase(); return when.words.some((w) => new RegExp(`\\b${w.toLowerCase().replace(/[-.]/g, '\\$&')}\\b`).test(hay)); }
  return true;
}
const triggerReason = (trig) => (trig.when === 'pattern-tag-or-deep-dive' ? 'no non-default pattern: tag and no deep-dive phrase' : trig.when === 'graph-tools' ? 'no code-review-graph tool in the session' : trig.when === 'placeholder' ? 'no {{VAR}} in the message or a file read before' : 'the message and folder name no listed repo or company');

// ---- detectors ---------------------------------------------------------------------------------------------------
const isInstructionFile = (p, cwd) => /\/\.copilot\/instructions\/[^/]+$/.test(p) || /\/core\.instructions\.md$/.test(p)
  || p === path.join(HOME, '.codex', 'AGENTS.md') || p === path.join(HOME, '.claude', 'CLAUDE.md')
  || (cwd && (p === path.join(cwd, 'AGENTS.md') || p === path.join(cwd, 'CLAUDE.md')));

/** Every finding of one session: { id, turn, at, cost, text, detail? }. */
function detect(s) {
  const f = [];
  const add = (id, turn, cost, text) => f.push({ id, tool: s.tool, session: s.id, turn: turn + 1, at: s.turns[turn].at, cost, text });
  const fullReads = new Map(); // path → true once read in full (EA-5)
  const dups = [];
  let prev = null; let first = true;
  for (const [ti, t] of s.turns.entries()) {
    const turnTools = [];
    let run = [];
    const flush = () => {
      if (run.length >= T.serialRun) {
        const extra = run.slice(1);
        add('EA-1', ti, extra.reduce((k, r) => k + r.req.cost, 0), `${run.length} requests in a row each read one file: ${extra.length} extra, ${n(extra.reduce((k, r) => k + r.req.ctx, 0))} context tokens re-sent · ${run.map((r) => path.basename(r.path)).join(', ')}`);
      }
      run = [];
    };
    let edited = false;
    for (const [ri, r] of t.requests.entries()) {
      // EA-1: exactly one tool call that reads exactly one file, and its path was not in the previous output
      const single = r.tools.length === 1 && r.tools[0].reads.length === 1 && (r.tools[0].commands ?? 1) <= 1;
      if (single) {
        const p = r.tools[0].reads[0];
        const dependent = run.length && run.at(-1).tool.outText.includes(path.basename(p));
        if (dependent) flush();
        run.push({ req: r, path: p, tool: r.tools[0] });
      } else flush();
      for (const tool of r.tools) {
        if (tool.edits.length || tool.mutates) edited = true;
        for (const p of tool.edits) fullReads.delete(p);
        if (tool.mutates) fullReads.clear();
        for (const p of tool.reads) {
          if (ti === 0 && ri < T.startRequests && isInstructionFile(p, s.cwd)) add('EA-2', ti, t.requests[ri + 1]?.cost ?? 0, `read ${tilde(p)} with ${tool.name}; the agent loads it by itself`);
          for (const trig of TRIGGERS) if (matchesTrigger(p, trig) && !triggerHolds(trig, s, t, turnTools)) add('EA-3', ti, t.requests[ri + 1]?.cost ?? 0, `read ${tilde(p)}: ${triggerReason(trig)}`);
        }
        for (const p of tool.full) {
          if (fullReads.has(p)) dups.push({ ti, p, chars: tool.outChars });
          fullReads.set(p, true);
        }
        if (tool.outChars > T.bigOutput) add('EA-4', ti, 0, `${tool.name} returned ${n(tool.outChars)} characters${tool.reads[0] ? ` · ${tilde(tool.reads[0])}` : tool.cmd ? ` · ${short(tool.cmd)}` : ''}`);
        if (tool.search && tool.outChars > T.bigSearch) add('EA-10', ti, 0, `unscoped search returned ${n(tool.outChars)} characters · ${short(tool.cmd)}`);
        turnTools.push(tool);
      }
      // EA-6: a request that wrote (Codex: did not read) most of a large context to the cache
      if (r.afterCompaction) fullReads.clear();
      if (!first && !r.afterCompaction && r.ctx > T.rebuildContext && (s.tool === 'codex' ? r.cr < 0.5 * r.ctx : r.cw > 0.5 * r.ctx)) {
        const gap = (Date.parse(r.at) - Date.parse(prev.at)) / 60000;
        const expired = prev.expires ? Date.parse(r.at) > Date.parse(prev.expires) : gap > T.cacheTtlMin[s.tool];
        const tokens = s.tool === 'codex' ? r.ctx - r.cr : r.cw;
        if (expired) add('EA-6a', ti, r.cost, `after a ${n(gap)}-minute pause, ${n(tokens)} tokens written to the cache again`);
        else add('EA-6b', ti, r.cost, `${n(tokens)} tokens written to the cache again ${n(gap)} minutes after the previous request`);
      }
      prev = r; first = false;
    }
    flush();
    // EA-7: large context or compaction
    const peak = Math.max(0, ...t.requests.map((r) => r.ctx));
    const parts = [];
    if (peak > T.peak) parts.push(`peak context ${n(peak)} of ${n(s.window)} (${Math.round((100 * peak) / s.window)}%)${peak > T.nearWindow * s.window ? ', near the window' : ''}`);
    for (const c of t.compactions) parts.push(c.pre ? `compaction from ${n(c.pre)}${c.post ? ` to ${n(c.post)}` : ''}` : 'compaction');
    if (parts.length) add('EA-7', ti, 0, parts.join(' · '));
    // EA-9: many requests, no edit, short final answer
    const lastText = t.requests.at(-1)?.text ?? 0;
    if (t.requests.length >= T.manyRequests && !edited && lastText > 0 && lastText < T.shortAnswer) add('EA-9', ti, 0, `${t.requests.length} requests, no file edited, final answer ${n(lastText)} characters`);
  }
  if (dups.length >= T.dupReads) for (const d of dups) add('EA-5', d.ti, 0, `${tilde(d.p)} read in full again (${n(d.chars)} characters)`);
  return f;
}

/** EA-8 from the turn token history: subagents cost more than the main agent in a turn. */
function detectSubagents(hist) {
  return hist.filter((r) => (r.thisTurnSubagents?.calls || 0) > 0 && (r.thisTurnSubagents?.cost || 0) > (r.thisTurn?.cost || 0))
    .map((r) => ({ id: 'EA-8', tool: r.tool, session: r.session, turn: r.turn, at: r.at, cost: r.thisTurnSubagents.cost, text: `subagents ${money(r.thisTurnSubagents.cost, UNIT[r.tool])} against the main agent's ${money(r.thisTurn.cost || 0, UNIT[r.tool])}` }));
}

// ---- outliers (AU-6) ---------------------------------------------------------------------------------------------
function turnStats(sessions) {
  const by = {};
  for (const s of sessions) if (!s.scripted) for (const t of s.turns) { const g = (by[s.tool] ??= { cost: [], req: [] }); g.cost.push(t.requests.reduce((k, r) => k + r.cost, 0)); g.req.push(t.requests.length); }
  return Object.fromEntries(Object.entries(by).map(([k, g]) => [k, { cost: quantile(g.cost, 0.9), req: quantile(g.req, 0.9) }]));
}
function turnOutliers(s, p90) {
  if (!p90) return [];
  const out = [];
  for (const [ti, t] of s.turns.entries()) {
    const cost = t.requests.reduce((k, r) => k + r.cost, 0);
    const why = [];
    if (p90.cost != null && cost > p90.cost && cost > 0) why.push(`cost ${money(cost, UNIT[s.tool])}`);
    if (p90.req != null && t.requests.length > p90.req) why.push(`${t.requests.length} requests`);
    if (why.length) out.push({ turn: ti + 1, at: t.at, text: why.join(', ') });
  }
  return out;
}

// ---- the session report (AU-3) -----------------------------------------------------------------------------------
function findSession(arg, skipped) {
  const asPath = path.resolve(arg);
  if (fs.existsSync(asPath) && fs.statSync(asPath).isFile()) {
    const tool = asPath.includes(`${path.sep}session-state${path.sep}`) ? 'copilot' : /rollout-/.test(asPath) ? 'codex' : 'claude';
    return READERS[tool](asPath, skipped);
  }
  const idOf = (tool, f) => (tool === 'copilot' ? path.basename(path.dirname(f)) : tool === 'codex' ? path.basename(f, '.jsonl').replace(/^rollout-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-/, '') : path.basename(f, '.jsonl'));
  const hits = sessionFiles().filter(([tool, f]) => idOf(tool, f).startsWith(arg));
  if (hits.length > 1) { console.error(`efficiency-audit: "${arg}" matches ${hits.length} sessions; give more of the id`); process.exit(2); }
  if (!hits.length) { console.error(`efficiency-audit: no session matches "${arg}"`); process.exit(2); }
  return READERS[hits[0][0]](hits[0][1], skipped);
}

function summarize(findings) {
  const by = {};
  for (const x of findings) { const g = (by[x.id] ??= { count: 0, cost: 0, items: [] }); g.count++; g.cost += x.cost; g.items.push(x); }
  return Object.keys(DETECTORS).filter((id) => by[id]).map((id) => ({ id, ...by[id] }));
}

function sessionReport() {
  const skipped = { lines: 0, files: 0 };
  const arg = args[1];
  if (!arg) { console.error('efficiency-audit: session needs a session id, id prefix or log path'); process.exit(2); }
  const s = findSession(arg, skipped);
  const hist = loadHistory(skipped).filter((r) => r.tool === s.tool && r.session === s.id);
  const findings = [...detect(s), ...detectSubagents(hist)];
  const p90 = turnStats(loadSessions({ lines: 0, files: 0 }))[s.tool];
  const outliers = turnOutliers(s, p90);
  const requests = s.turns.reduce((k, t) => k + t.requests.length, 0);
  const cost = s.turns.reduce((k, t) => k + t.requests.reduce((j, r) => j + r.cost, 0), 0);
  if (args.includes('--json')) {
    console.log(JSON.stringify({ schema: 'efficiency-audit/v1', kind: 'session', tool: s.tool, session: s.id, scripted: s.scripted, turns: s.turns.length, requests, cost, unit: UNIT[s.tool], findings: findings.map(({ text, ...x }) => ({ ...x, evidence: text })), outliers, skipped }, null, 2));
    return;
  }
  const out = [`${NAME[s.tool]} session ${s.id.slice(0, 8)}${s.scripted ? ' (scripted)' : ''} · started ${s.turns[0]?.at?.slice(0, 10) ?? '?'} · ${plural(s.turns.length, 'turn')} · ${plural(requests, 'request')} · ${money(cost, UNIT[s.tool])}${s.tool === 'claude' ? ' at list price' : ''}`];
  const groups = summarize(findings);
  if (!groups.length) out.push('  no findings');
  for (const g of groups) {
    out.push(`  ${g.id.padEnd(5)} ${DETECTORS[g.id]}: ${plural(g.count, 'finding')}${g.cost ? ` · ${money(g.cost, UNIT[s.tool])}` : ''}`);
    for (const x of g.items.slice(0, 3)) out.push(`        turn ${x.turn}: ${x.text}`);
    if (g.items.length > 3) out.push(`        … ${g.items.length - 3} more`);
    out.push(`        fix: ${FIX[g.id]}`);
  }
  if (outliers.length) out.push(`  outliers (above the 90th percentile of ${NAME[s.tool]} turns): ${outliers.slice(0, 5).map((o) => `turn ${o.turn} (${o.text})`).join('; ')}`);
  if (skipped.lines || skipped.files) out.push(`  skipped: ${plural(skipped.lines, 'unreadable line')}, ${plural(skipped.files, 'unreadable file')}`);
  console.log(out.join('\n'));
}

// ---- the weekly report, history and tracker (AU-4 … AU-7) ---------------------------------------------------------
const historyFile = () => path.join(home.copilot, 'efficiency-audit', 'history.jsonl');

function weekReport() {
  const skipped = { lines: 0, files: 0 };
  const ref = opt('--week') ? new Date(`${opt('--week')}T12:00:00Z`) : now();
  if (Number.isNaN(ref.getTime())) { console.error('efficiency-audit: --week needs a date (YYYY-MM-DD)'); process.exit(2); }
  const from = weekStart(ref); const to = new Date(from.getTime() + 7 * 864e5);
  const week = day(from);
  const inWeek = (at) => { const t = Date.parse(at); return t >= from.getTime() && t < to.getTime(); };
  const sessions = loadSessions(skipped);
  const hist = loadHistory(skipped);
  const p90 = turnStats(sessions);
  const past = readLines(historyFile(), { lines: 0, files: 0 }).filter((h) => h.schema === 'efficiency-audit/v1' && h.week < week);
  const tools = {};
  for (const tool of Object.keys(NAME)) tools[tool] = { sessions: 0, turns: 0, requests: 0, cost: 0, scripted: { sessions: 0, turns: 0 }, findings: [], outliers: [] };
  for (const s of sessions) {
    const g = tools[s.tool];
    const turns = s.turns.filter((t) => inWeek(t.at));
    if (!turns.length) continue;
    if (s.scripted) { g.scripted.sessions++; g.scripted.turns += turns.length; continue; }
    g.sessions++; g.turns += turns.length;
    for (const t of turns) { g.requests += t.requests.length; g.cost += t.requests.reduce((k, r) => k + r.cost, 0); }
    g.findings.push(...detect(s).filter((x) => inWeek(x.at)));
    g.outliers.push(...turnOutliers(s, p90[s.tool]).filter((o) => inWeek(o.at)).map((o) => ({ ...o, session: s.id })));
  }
  const scriptedIds = new Set(sessions.filter((s) => s.scripted).map((s) => s.id));
  for (const x of detectSubagents(hist.filter((r) => inWeek(r.at) && !scriptedIds.has(r.session)))) tools[x.tool].findings.push(x);

  // AU-5: one history line per tool and detector, replacing this week's lines
  const rows = [];
  for (const [tool, g] of Object.entries(tools)) {
    if (!g.turns) continue;
    const groups = Object.fromEntries(summarize(g.findings).map((x) => [x.id, x]));
    for (const id of Object.keys(DETECTORS)) {
      const c = groups[id]?.count ?? 0;
      const prior = past.filter((h) => h.tool === tool && h.detector === id).sort((a, b) => a.week.localeCompare(b.week)).slice(-4).map((h) => h.rate);
      const rate = Math.round((10000 * c) / g.turns) / 100;
      const base = prior.length ? Math.round(100 * median(prior)) / 100 : null;
      const flagged = base != null && c >= T.outlierMin && rate > T.outlierFactor * base;
      rows.push({ schema: 'efficiency-audit/v1', week, tool, detector: id, turns: g.turns, findings: c, rate, cost: Math.round((groups[id]?.cost ?? 0) * 1e6) / 1e6, unit: UNIT[tool], baseline: base, baselineWeeks: prior.length, flagged });
    }
  }
  if (rows.length) {
    const keep = readLines(historyFile(), { lines: 0, files: 0 }).filter((h) => h.week !== week);
    fs.mkdirSync(path.dirname(historyFile()), { recursive: true });
    fs.writeFileSync(historyFile(), [...keep, ...rows].map((h) => JSON.stringify(h)).join('\n') + '\n');
  }

  // AU-7: suggested records and tracker items for flagged detectors (and any EA-2, which is a regression)
  const flags = rows.filter((r) => r.flagged || (r.detector === 'EA-2' && r.findings > 0));
  const records = flags.map((r) => {
    const doc = RECORD_IN[r.detector]?.[r.tool] ?? (typeof RECORD_IN[r.detector] === 'string' ? RECORD_IN[r.detector] : RECORD_IN.default);
    return `${doc}: week of ${week}, ${NAME[r.tool]}: ${r.detector} ${DETECTORS[r.detector]}, ${plural(r.findings, 'finding')} in ${plural(r.turns, 'turn')} (${r.rate} per 100 turns${r.baseline != null ? `, median of the last ${plural(r.baselineWeeks, 'week')} ${r.baseline}` : ''})${r.cost ? `, ${money(r.cost, r.unit)}` : ''}; source: efficiency-audit.mjs week --week ${week}`;
  });
  const items = flags.slice(0, T.trackerMax).map((r) => ({ title: `Efficiency audit ${week}: ${NAME[r.tool]} ${r.detector} ${DETECTORS[r.detector]}`, next: `Run efficiency-audit.mjs week --week ${week}, read the top findings, then ${FIX[r.detector]}` }));

  if (args.includes('--json')) {
    console.log(JSON.stringify({ schema: 'efficiency-audit/v1', kind: 'week', week, tools: Object.fromEntries(Object.entries(tools).map(([k, g]) => [k, { sessions: g.sessions, turns: g.turns, requests: g.requests, cost: g.cost, unit: UNIT[k], scripted: g.scripted, detectors: rows.filter((r) => r.tool === k), findings: g.findings.map(({ text, ...x }) => ({ ...x, evidence: text })), outliers: g.outliers }])), records, tracker: items, skipped }, null, 2));
  } else {
    const out = [`Efficiency audit · week of ${week} (Monday) to ${day(new Date(to.getTime() - 864e5))}`];
    for (const [tool, g] of Object.entries(tools)) {
      if (!g.turns && !g.scripted.turns) continue;
      out.push(`${NAME[tool]} · ${plural(g.sessions, 'session')} · ${plural(g.turns, 'turn')} · ${plural(g.requests, 'request')} · ${money(g.cost, UNIT[tool])}${tool === 'claude' ? ' at list price' : ''}`);
      const mine = rows.filter((r) => r.tool === tool && r.findings > 0);
      if (g.turns && !mine.length) out.push('  no findings');
      for (const r of mine) out.push(`  ${r.detector.padEnd(5)} ${DETECTORS[r.detector]}: ${plural(r.findings, 'finding')} · ${r.rate} per 100 turns${r.cost ? ` · ${money(r.cost, r.unit)}` : ''}${r.baseline != null ? ` · median of the last ${plural(r.baselineWeeks, 'week')} ${r.baseline}` : ''}${r.flagged ? ' · flagged' : ''}`);
      const top = [...g.findings].filter((x) => x.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 3);
      for (const x of top) out.push(`  top: ${x.id} session ${x.session.slice(0, 8)} turn ${x.turn}: ${x.text} · ${money(x.cost, UNIT[tool])}`);
      if (g.outliers.length) out.push(`  outliers: ${g.outliers.slice(0, 3).map((o) => `session ${o.session.slice(0, 8)} turn ${o.turn} (${o.text})`).join('; ')}`);
      if (g.scripted.turns) out.push(`  scripted: ${plural(g.scripted.sessions, 'session')}, ${plural(g.scripted.turns, 'turn')} (not counted)`);
    }
    if (out.length === 1) out.push('no sessions this week');
    if (records.length) { out.push('Suggested records (write them, then run review-docs):'); for (const r of records) out.push(`  ${r}`); }
    if (items.length) { out.push(args.includes('--tracker') ? 'Tracker:' : 'Tracker (run with --tracker <repo folder> to add):'); for (const i of items) out.push(`  node copilot/tracker/tracker.mjs --add ${JSON.stringify(i.title)} --next ${JSON.stringify(i.next)}`); }
    if (skipped.lines || skipped.files) out.push(`skipped: ${plural(skipped.lines, 'unreadable line')}, ${plural(skipped.files, 'unreadable file')}`);
    console.log(out.join('\n'));
  }
  const repoDir = opt('--tracker');
  if (repoDir && items.length) {
    const trackerFile = path.join(repoDir, 'TRACKER.md');
    const existing = fs.existsSync(trackerFile) ? fs.readFileSync(trackerFile, 'utf8') : '';
    for (const i of items) {
      if (existing.includes(i.title)) { if (!args.includes('--json')) console.log(`  already tracked: ${i.title}`); continue; }
      const res = execFileSync(process.execPath, [path.join(here, '..', 'tracker', 'tracker.mjs'), '--add', i.title, '--next', i.next], { cwd: repoDir, encoding: 'utf8' });
      if (!args.includes('--json')) console.log(`  ${res.trim()}`);
    }
  }
}

// ---- check-triggers (AU-10) --------------------------------------------------------------------------------------
function checkTriggers() {
  const core = fs.readFileSync(path.join(here, '..', 'instructions', 'core.instructions.md'), 'utf8');
  const missing = TRIGGERS.filter((t) => !core.includes(t.core ?? t.file));
  for (const t of missing) console.log(`  fail  AU-10  triggers.json: "${t.core ?? t.file}" is not in core.instructions.md`);
  console.log(missing.length ? `FAIL (${missing.length})` : `PASS: ${TRIGGERS.length} triggers named in core.instructions.md`);
  process.exit(missing.length ? 1 : 0);
}

const cmd = args[0];
if (cmd === 'session') sessionReport();
else if (cmd === 'week') weekReport();
else if (cmd === 'check-triggers') checkTriggers();
else { console.error('usage: efficiency-audit.mjs session <id|path> [--json] | week [--week YYYY-MM-DD] [--json] [--tracker <repo folder>] | check-triggers'); process.exit(2); }
