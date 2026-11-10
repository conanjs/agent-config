#!/usr/bin/env node
// turn-tokens.mjs — the turn token report (turn-tokens/v1: turn-tokens.schema.md, specs/017).
//
// Usage:
//   turn-tokens.mjs --hook claude|codex|copilot [--text] [--wait-ms <n>]   the end-of-turn hook: hook JSON on stdin, report out
//   turn-tokens.mjs --statusline                                   Claude Code's status line: saves the limits
//   turn-tokens.mjs --remind <reminder file>                       the cache reminder a report schedules (TT-18)
//
// After every turn it reads the tool's own log (the Claude Code transcript or the Codex rollout file), prints one
// report as {"systemMessage": …} (plain text with --text) and appends it to turn-tokens/<session id>.jsonl in the
// tool's own folder. No dependencies, no network. In hook mode it always exits 0, so a turn never fails because of it.
// When the last request's context is large it adds a Cache line (TT-17) and schedules a desktop notification for
// shortly before that cache expires, skipped if the session moved on (TT-18).

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { anthropic, codex as codexRates, codexFastTiers } from './prices.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const now = () => new Date(process.env.TURN_TOKENS_NOW ?? Date.now());
const waitMs = Number(opt('--wait-ms') ?? process.env.TURN_TOKENS_WAIT_MS ?? 3000);
const home = {
  claude: process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
  codex: process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
  copilot: process.env.COPILOT_HOME || path.join(os.homedir(), '.copilot'),
};
const POLL_MS = 250;
const CACHE_LINE_MIN = 100000; // TT-17: show the Cache line from this context size
const LEAD_MIN = Number(process.env.TURN_TOKENS_REMIND_LEAD_MIN ?? 2); // TT-18: notify this many minutes before expiry
const MIN_MS = 60000;
const REMIND_POLL_MS = Number(process.env.TURN_TOKENS_REMIND_POLL_MS ?? 30000); // TT-19: how often a waiting reminder re-checks
const NOTE = '  note: the final reply was not in the log yet; the session total will include it in the next report';

class Unavailable extends Error {}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safeName = (id) => String(id).replace(/[^\w.-]/g, '_');

function readJsonLines(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { throw new Unavailable(`cannot read the log ${file}`); }
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* a line still being written */ }
  }
  return out;
}

function firstLine(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(65536);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return JSON.parse(buf.toString('utf8', 0, n).split('\n')[0]);
  } catch { return null; }
}

// ---- sums (TT-5) -----------------------------------------------------------------------------------------

const newSum = () => ({ calls: 0, peakContext: 0, newInput: 0, cacheWrite: 0, cacheRead: 0, output: 0, outputAtLeast: false, num: 0, pricedCalls: 0, unpriced: [], tools: {} });

/** call: { newInput, cacheWrite, cacheRead, context, output, placeholder, price: number|null, model, tools: [] } */
function add(sum, call) {
  sum.calls += 1;
  sum.peakContext = Math.max(sum.peakContext, call.context);
  sum.newInput += call.newInput;
  sum.cacheWrite += call.cacheWrite;
  sum.cacheRead += call.cacheRead;
  sum.output += call.output;
  if (call.placeholder) sum.outputAtLeast = true; // TT-6
  if (call.price === null) { if (!sum.unpriced.includes(call.model)) sum.unpriced.push(call.model); } else { sum.num += call.price; sum.pricedCalls += 1; }
  for (const t of call.tools) sum.tools[t] = (sum.tools[t] ?? 0) + 1;
}

const sumOf = (calls) => { const s = newSum(); for (const c of calls) add(s, c); return s; };

// ---- Claude Code (TT-2, TT-6, TT-7, TT-9) ----------------------------------------------------------------

const claudeModel = (m) => String(m ?? '').replace(/\[1m\]$/i, '').replace(/-\d{8}$/, '');

/** Dollars × 1e12 (micro-dollars × tokens per million), or null without a price row. TT-9 */
function claudePrice(model, u) {
  let p = anthropic[claudeModel(model)];
  if (!p) return null;
  const context = u.input + u.cacheWrite + u.cacheRead;
  if (p.over100k && context > 100000) p = { ...p.over100k, residency: p.residency };
  if (u.speed === 'fast' && p.fast) {
    const k = p.fast.input / p.input;
    p = { input: p.fast.input, write5m: p.write5m * k, write1h: p.write1h * k, read: p.read * k, output: p.fast.output, residency: p.residency };
  }
  const oneHour = Math.min(u.oneHour, u.cacheWrite);
  let num = u.input * p.input + (u.cacheWrite - oneHour) * p.write5m + oneHour * p.write1h + u.cacheRead * p.read + u.output * p.output;
  if (p.residency && u.geo === 'us') num *= 1.1;
  return num;
}

function isPrompt(e) {
  if (e.type !== 'user' || e.isMeta || e.isCompactSummary || e.isVisibleInTranscriptOnly) return false;
  const c = e.message?.content;
  const localOutput = (t) => /^\s*<local-command-/.test(t ?? ''); // the printed output of a local command such as /compact
  if (typeof c === 'string') return c.trim() !== '' && !localOutput(c);
  return Array.isArray(c) && !c.some((b) => b?.type === 'tool_result') && c.some((b) => b?.type === 'image' || (b?.type === 'text' && !localOutput(b.text)));
}

/** Replies of one transcript, each once (message.id + requestId), stubs left out. TT-2 */
function claudeReplies(lines) {
  const byKey = new Map();
  lines.forEach((e, idx) => {
    if (e.type !== 'assistant') return;
    const m = e.message ?? {};
    if (!m.usage || m.model === '<synthetic>') return;
    const key = `${m.id}|${e.requestId}`;
    let r = byKey.get(key);
    if (!r) {
      const u = m.usage;
      const usage = {
        input: u.input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0,
        output: u.output_tokens ?? 0, oneHour: u.cache_creation?.ephemeral_1h_input_tokens ?? 0, speed: u.speed, geo: u.inference_geo,
      };
      r = { idx, ts: e.timestamp ?? '', model: m.model, usage, stop: m.stop_reason ?? null, tools: [] };
      byKey.set(key, r);
    }
    r.lastIdx = idx;
    r.stop = m.stop_reason ?? r.stop;
    for (const b of Array.isArray(m.content) ? m.content : []) {
      if ((b?.type === 'tool_use' || b?.type === 'server_tool_use') && b.name) r.tools.push(b.name); // TT-8
    }
  });
  return [...byKey.values()].map((r) => ({
    idx: r.idx, lastIdx: r.lastIdx, ts: r.ts, stop: r.stop, model: r.model, tools: r.tools,
    newInput: r.usage.input, cacheWrite: r.usage.cacheWrite, cacheRead: r.usage.cacheRead,
    context: r.usage.input + r.usage.cacheWrite + r.usage.cacheRead, output: r.usage.output,
    placeholder: r.stop === null, price: claudePrice(r.model, r.usage), oneHour: r.usage.oneHour,
  }));
}

function analyzeClaude(file) {
  const lines = readJsonLines(file);
  const prompts = lines.map((e, i) => (isPrompt(e) ? i : -1)).filter((i) => i >= 0);
  const start = prompts.length ? prompts[prompts.length - 1] : -1;
  const startTs = start >= 0 ? lines[start].timestamp ?? '' : '';
  const replies = claudeReplies(lines);
  const turn = replies.filter((r) => r.idx > start);
  const last = turn.reduce((a, r) => (!a || r.lastIdx > a.lastIdx ? r : a), null);
  const final = Boolean(last && last.stop !== null && last.stop !== 'tool_use'); // TT-4

  const subDir = path.join(file.replace(/\.jsonl$/, ''), 'subagents'); // TT-7
  let subFiles = [];
  try { subFiles = fs.readdirSync(subDir).filter((f) => f.endsWith('.jsonl')).sort(); } catch { /* no subagents */ }
  const subs = subFiles.flatMap((f) => claudeReplies(readJsonLines(path.join(subDir, f))));
  // A prompt is a turn when a reply follows it, or when it is the last one (its replies may still be coming).
  const turns = prompts.filter((p, k) => k === prompts.length - 1 || replies.some((r) => r.idx > p && r.idx < prompts[k + 1]));
  return {
    turnNo: Math.max(turns.length, 1), final,
    turn: sumOf(turn), turnSubs: sumOf(subs.filter((r) => r.ts >= startTs)),
    session: sumOf(replies), sessionSubs: sumOf(subs), cache: claudeCache(replies),
  };
}

/** The main conversation's cache after its last request: 1 hour when its latest cache write was a 1-hour write, else 5 minutes. TT-17 */
function claudeCache(replies) {
  const last = replies.reduce((a, r) => (!a || r.lastIdx > a.lastIdx ? r : a), null);
  if (!last || !last.ts) return null;
  const write = [...replies].sort((x, y) => x.lastIdx - y.lastIdx).filter((r) => r.cacheWrite > 0).pop();
  const ttlMin = write && write.oneHour > 0 ? 60 : 5;
  return { at: last.ts, context: last.context, expiresAt: new Date(Date.parse(last.ts) + ttlMin * MIN_MS).toISOString(), ttlMin };
}

function claudeLimits(session) { // TT-10
  const dir = path.join(home.claude, 'turn-tokens');
  const own = path.join(dir, `statusline-${safeName(session)}.json`);
  const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  let saved = read(own);
  const contextWindow = saved?.contextWindow ?? null;
  if (!saved?.rateLimits) {
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => /^statusline-.*\.json$/.test(f)); } catch { /* none yet */ }
    const newest = files.map((f) => read(path.join(dir, f))).filter((s) => s?.rateLimits).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
    if (newest) saved = newest;
  }
  if (!saved?.rateLimits) return { contextWindow, limits: null };
  const windows = [['five_hour', '5-hour'], ['seven_day', 'weekly']]
    .filter(([k]) => saved.rateLimits[k])
    .map(([k, name]) => ({ name, usedPercent: Math.round(saved.rateLimits[k].used_percentage ?? 0), resetsAt: saved.rateLimits[k].resets_at ?? null }));
  return { contextWindow, limits: { source: 'statusline', at: saved.at, windows } };
}

// ---- Codex (TT-3, TT-7, TT-9, TT-10) ---------------------------------------------------------------------

function codexPrice(model, call, tier) {
  const r = codexRates[model];
  if (!r) return null;
  const num = call.newInput * r.input + call.cacheRead * r.cached + call.output * r.output;
  return codexFastTiers.includes(tier) ? num * 2 : num;
}

/** Every record of a rollout as a call, with its turn, model, tier, time and the tools of its turn. */
function codexCalls(lines) {
  const calls = [];
  const turns = new Map(); // turn_id → { model, ctxIdx, ts, tools: [] }
  let tier = 'default';
  let current = null;
  lines.forEach((e, idx) => {
    const p = e.payload ?? {};
    if (e.type === 'turn_context') {
      current = { id: p.turn_id, model: p.model, ctxIdx: idx, ts: e.timestamp ?? '', tools: [], toolTimes: [] };
      turns.set(p.turn_id, current);
    } else if (e.type === 'event_msg' && p.type === 'thread_settings_applied' && p.service_tier) {
      tier = p.service_tier;
    } else if (e.type === 'response_item' && (p.type === 'custom_tool_call' || p.type === 'function_call') && p.name && current) {
      current.tools.push(p.namespace ? `${p.namespace}.${p.name}` : p.name); // TT-8
      current.toolTimes.push(e.timestamp ?? '');
    } else if (e.type === 'token_usage_record') {
      const u = p.usage ?? {};
      const input = u.input_tokens ?? 0;
      const cached = Math.min(u.cached_input_tokens ?? 0, input);
      const model = turns.get(p.turn_id)?.model ?? current?.model;
      const call = { idx, ts: e.timestamp ?? '', turnId: p.turn_id, model, tools: [], newInput: input - cached, cacheWrite: 0, cacheRead: cached, context: input, output: u.output_tokens ?? 0, placeholder: false };
      call.price = codexPrice(model, call, tier);
      calls.push(call);
    }
  });
  return { calls, turns };
}

function codexChildren(threadId) { // TT-7
  const root = path.join(home.codex, 'sessions');
  let files = [];
  try { files = fs.readdirSync(root, { recursive: true }).filter((f) => /rollout-.*\.jsonl$/.test(f)).map((f) => path.join(root, f)); } catch { return []; }
  return files.filter((f) => {
    const meta = firstLine(f);
    const p = meta?.type === 'session_meta' ? meta.payload ?? {} : {};
    return p.session_id === threadId && p.id !== threadId && (p.thread_source === 'subagent' || p.source?.subagent);
  }).sort();
}

function analyzeCodex(file, turnId) {
  const lines = readJsonLines(file);
  const meta = lines.find((e) => e.type === 'session_meta')?.payload ?? {};
  const threadId = meta.id ?? meta.session_id;
  const { calls, turns } = codexCalls(lines);
  const order = [...new Set(calls.map((c) => c.turnId))];
  const target = turnId ?? order[order.length - 1] ?? [...turns.keys()].pop();
  const ctx = turns.get(target);
  const startIdx = ctx?.ctxIdx ?? -1;
  const nextIdx = lines.findIndex((e, i) => i > startIdx && e.type === 'turn_context');
  const end = nextIdx >= 0 ? nextIdx : lines.length;
  const startTs = ctx?.ts ?? '';
  const endTs = nextIdx >= 0 ? lines[nextIdx].timestamp ?? '' : null;
  const inTurn = calls.filter((c) => c.turnId === target);
  const turnSum = sumOf(inTurn);
  for (const t of ctx?.tools ?? []) turnSum.tools[t] = (turnSum.tools[t] ?? 0) + 1;

  let lastAnswer = -1; // TT-4: the turn's last assistant message must be followed by a usage record of the turn
  for (let i = Math.max(startIdx, 0); i < end; i++) {
    const p = lines[i].payload ?? {};
    if (lines[i].type === 'response_item' && p.type === 'message' && p.role === 'assistant') lastAnswer = i;
  }
  const final = lastAnswer >= 0 && inTurn.some((c) => c.idx > lastAnswer);

  let contextWindow = null;
  let limits = null;
  for (let i = 0; i < lines.length; i++) {
    const p = lines[i].payload ?? {};
    if (lines[i].type !== 'event_msg') continue;
    const w = p.type === 'task_started' ? p.model_context_window : p.type === 'token_count' ? p.info?.model_context_window : undefined;
    if (w && (contextWindow === null || (i > startIdx && i < end))) contextWindow = w;
    if (p.type === 'token_count' && p.rate_limits) limits = p.rate_limits;
  }

  const turnNo = order.includes(target) ? order.indexOf(target) + 1 : order.length + 1;
  const inWindow = (ts) => ts >= startTs && (endTs === null || ts < endTs);
  const turnSubs = newSum();
  const sessionSubs = newSum();
  for (const child of codexChildren(threadId)) {
    const c = codexCalls(readJsonLines(child));
    for (const call of c.calls) { add(sessionSubs, call); if (inWindow(call.ts)) add(turnSubs, call); }
    for (const t of c.turns.values()) t.tools.forEach((name, i) => { if (inWindow(t.toolTimes[i])) turnSubs.tools[name] = (turnSubs.tools[name] ?? 0) + 1; });
  }
  return {
    threadId, turnNo, final, contextWindow, turn: turnSum, turnSubs, session: sumOf(calls), sessionSubs,
    limits: limits ? { source: 'log', windows: codexWindows(limits) } : null,
  };
}

// ---- GitHub Copilot (TT-13 … TT-16, specs/018) -------------------------------------------------------------

function analyzeCopilot(file) {
  const lines = readJsonLines(file);
  const prompts = lines.map((e, i) => (e.type === 'user.message' ? i : -1)).filter((i) => i >= 0);
  const start = prompts.length ? prompts[prompts.length - 1] : -1;
  const calls = [];
  let contextWindow = null;
  let quota = null;
  let cache = null;
  lines.forEach((e, idx) => {
    const d = e.data ?? {};
    if (e.type === 'session.usage_record') { // TT-13, TT-15
      const u = d.usage ?? {};
      if (u.initiator !== 'sub-agent' && e.timestamp) { // TT-17: Copilot logs when each call's cache expires
        cache = { at: e.timestamp, context: u.inputTokens ?? 0, expiresAt: u.cacheExpiresAt ?? new Date(Date.parse(e.timestamp) + 5 * MIN_MS).toISOString() };
      }
      const input = u.inputTokens ?? 0;
      const cacheRead = u.cacheReadTokens ?? 0;
      const cacheWrite = u.cacheWriteTokens ?? 0;
      if (u.maxPromptTokens) contextWindow = u.maxPromptTokens;
      const nano = u.copilotUsage?.totalNanoAiu;
      calls.push({ idx, model: u.model, tools: [], newInput: Math.max(input - cacheRead - cacheWrite, 0), cacheWrite, cacheRead, context: input, output: u.outputTokens ?? 0, placeholder: false, price: typeof nano === 'number' ? nano : null });
    }
    const q = findKey(d, 'quotaSnapshots');
    if (q?.premium_interactions) quota = q.premium_interactions; // TT-16
  });
  const turn = sumOf(calls.filter((c) => c.idx > start));
  for (let i = start + 1; i < lines.length; i++) { // TT-14
    const name = lines[i].type === 'tool.execution_start' ? lines[i].data?.toolName : null;
    if (name) turn.tools[name] = (turn.tools[name] ?? 0) + 1;
  }
  const answers = lines.filter((e, i) => i > start && e.type === 'assistant.message');
  const lastAnswer = answers[answers.length - 1];
  const final = Boolean(lastAnswer && !(lastAnswer.data?.toolRequests ?? []).length); // TT-4
  return {
    turnNo: Math.max(prompts.length, 1), final, contextWindow, turn, turnSubs: newSum(), session: sumOf(calls), sessionSubs: newSum(),
    limits: quota ? { source: 'log', monthly: quota } : null, cache,
  };
}

function findKey(o, key, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 6) return undefined;
  if (Object.prototype.hasOwnProperty.call(o, key)) return o[key];
  for (const v of Object.values(o)) { const r = findKey(v, key, depth + 1); if (r !== undefined) return r; }
  return undefined;
}

function codexWindows(rl) {
  return ['primary', 'secondary'].filter((k) => rl[k]).map((k) => {
    const m = rl[k].window_minutes;
    const name = m === 300 ? '5-hour' : m === 10080 ? 'weekly' : `${m}-minute`;
    return { name, usedPercent: Math.round(rl[k].used_percent ?? 0), resetsAt: rl[k].resets_at ?? null };
  });
}

// ---- the report ------------------------------------------------------------------------------------------

const n = (x) => x.toLocaleString('en-US');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const when = (epoch) => { const d = new Date(epoch * 1000); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hhmm(d)}`; };
const callsText = (c) => `${n(c)} call${c === 1 ? '' : 's'}`;
const toolsText = (tools) => Object.entries(tools).map(([k, v]) => (v > 1 ? `${k} ×${v}` : k)).join(', ');
const cost = (sum, unit) => Math.round((sum.num / (unit === 'usd' ? 1e12 : 1e9)) * 1e6) / 1e6;
const dollars = (c) => `$${c < 1 ? c.toFixed(3) : c.toFixed(2)}`;
const UNIT = { claude: 'usd', codex: 'credits', copilot: 'ai-credits' };

function money(sum, unit, suffix = '') { // TT-9, TT-15
  if (sum.pricedCalls === 0 && sum.unpriced.length) return `price unknown: ${sum.unpriced.join(', ')}`;
  const c = cost(sum, unit);
  const amount = unit === 'usd' ? `≈ ${dollars(c)}`
    : unit === 'ai-credits' ? `≈ ${c.toFixed(2)} AI credits (${dollars(c / 100)})` : `≈ ${c.toFixed(2)} credits`;
  return amount + suffix + (sum.unpriced.length ? ` + unpriced: ${sum.unpriced.join(', ')}` : '');
}

function tokens(sum, withCacheWrite) {
  return [`new input ${n(sum.newInput)}`, ...(withCacheWrite ? [`cache write ${n(sum.cacheWrite)}`] : []),
    `cache read ${n(sum.cacheRead)}`, `output ${sum.outputAtLeast ? 'at least ' : ''}${n(sum.output)}`].join(' · ');
}

function render(tool, a) {
  const usd = UNIT[tool];
  const win = a.contextWindow ? ` of ${n(a.contextWindow)} (${Math.round((a.turn.peakContext / a.contextWindow) * 100)}%)` : '';
  const cw = tool !== 'codex';
  const out = [`Turn ${a.turnNo} · ${callsText(a.turn.calls)} · peak context ${n(a.turn.peakContext)}${win} · ${tokens(a.turn, cw)} · ${money(a.turn, usd)}`];
  if (Object.keys(a.turn.tools).length) out.push(`  tools: ${toolsText(a.turn.tools)}`);
  if (a.turnSubs.calls) {
    const t = Object.keys(a.turnSubs.tools).length ? ` · tools: ${toolsText(a.turnSubs.tools)}` : '';
    out.push(`  subagents: ${callsText(a.turnSubs.calls)} · output ${a.turnSubs.outputAtLeast ? 'at least ' : ''}${n(a.turnSubs.output)} · ${money(a.turnSubs, usd)}${t}`);
  }
  if (!a.final) out.push(NOTE);
  out.push(`Session · ${callsText(a.session.calls)} · ${tokens(a.session, cw)} · ${money(a.session, usd, tool === 'claude' ? ' at list price' : '')}`);
  if (a.sessionSubs.calls) {
    out.push(`  subagents: ${callsText(a.sessionSubs.calls)} · output ${a.sessionSubs.outputAtLeast ? 'at least ' : ''}${n(a.sessionSubs.output)} · ${money(a.sessionSubs, usd)}`);
  }
  const c = cacheLine(tool, a.cache);
  if (c) out.push(c);
  out.push(limitsLine(tool, a.limits));
  return out.join('\n');
}

/** TT-17: Claude Code and Copilot, when the last request sent 100,000 tokens or more. */
function cacheLine(tool, cache) {
  if (!showsCache(tool, cache)) return null;
  return `Cache · ${n(cache.context)} tokens cached until ${hhmm(new Date(cache.expiresAt))} · before a longer break: /compact`;
}
const showsCache = (tool, cache) => tool !== 'codex' && Boolean(cache) && cache.context >= CACHE_LINE_MIN && !Number.isNaN(Date.parse(cache.expiresAt));

function limitsLine(tool, limits) { // TT-10, TT-16
  if (tool === 'copilot') {
    const m = limits?.monthly;
    if (!m) return "Limits · unknown: none in this session's log yet";
    if (m.isUnlimitedEntitlement) return 'Limits · monthly allowance unlimited';
    const used = Math.round(100 - (m.remainingPercentage ?? 100));
    const reset = m.resetDate ? `, resets ${when(Date.parse(m.resetDate) / 1000)}` : '';
    return `Limits · monthly ${used}% used (${n(m.usedRequests ?? 0)} of ${n(m.entitlementRequests ?? 0)})${reset}`;
  }
  if (!limits || !limits.windows.length) {
    return tool === 'claude'
      ? 'Limits · unknown: Claude Code shares them only with its status line (turn-tokens --statusline)'
      : "Limits · unknown: none in this thread's log yet";
  }
  const parts = limits.windows.map((w) => `${w.name} ${w.usedPercent}% used${w.resetsAt ? `, resets ${when(w.resetsAt)}` : ''}`);
  if (limits.source === 'statusline' && limits.at) parts.push(`from the status line at ${hhmm(new Date(limits.at))}`);
  return `Limits · ${parts.join(' · ')}`;
}

function record(tool, session, a) { // TT-11
  const unit = UNIT[tool];
  const plain = (s) => ({ calls: s.calls, peakContext: s.peakContext, newInput: s.newInput, cacheWrite: s.cacheWrite, cacheRead: s.cacheRead, output: s.output, outputAtLeast: s.outputAtLeast, cost: cost(s, unit), unpriced: s.unpriced, tools: s.tools });
  return {
    schema: 'turn-tokens/v1', at: now().toISOString(), tool, session, turn: a.turnNo, pending: !a.final, unit, contextWindow: a.contextWindow ?? null,
    thisTurn: plain(a.turn), thisTurnSubagents: plain(a.turnSubs), sessionTotal: plain(a.session), sessionSubagents: plain(a.sessionSubs), limits: a.limits,
  };
}

function appendHistory(tool, session, rec) {
  try {
    const dir = path.join(home[tool], 'turn-tokens');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, `${safeName(session)}.jsonl`), JSON.stringify(rec) + '\n');
  } catch { /* the report still shows */ }
}

function codexRollout(threadId) {
  const root = path.join(home.codex, 'sessions');
  try { return fs.readdirSync(root, { recursive: true }).filter((f) => f.endsWith(`-${threadId}.jsonl`)).map((f) => path.join(root, f))[0]; } catch { return undefined; }
}

async function hook(tool) { // TT-1
  let payload;
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { throw new Unavailable('the hook input is not JSON'); }
  const session = payload.session_id ?? payload.sessionId ?? 'unknown';
  const file = payload.transcript_path || payload.transcriptPath
    || (tool === 'codex' ? codexRollout(session) : undefined)
    || (tool === 'copilot' ? path.join(home.copilot, 'session-state', safeName(session), 'events.jsonl') : undefined);
  if (!file) throw new Unavailable('the hook input has no transcript_path');
  const analyze = () => (tool === 'claude' ? analyzeClaude(file) : tool === 'codex' ? analyzeCodex(file, payload.turn_id) : analyzeCopilot(file));
  let a = analyze();
  for (let waited = 0; !a.final && waited < waitMs; waited += POLL_MS) { // TT-4
    await sleep(Math.min(POLL_MS, waitMs - waited));
    a = analyze();
  }
  if (tool === 'claude') Object.assign(a, claudeLimits(session));
  appendHistory(tool, session, record(tool, session, a));
  scheduleReminder(tool, session, file, a.cache);
  return render(tool, a);
}

// ---- the cache reminder (TT-18) -------------------------------------------------------------------------------

const NAME = { claude: 'Claude Code', copilot: 'Copilot' };
const reminderFile = (tool, session) => path.join(home[tool], 'turn-tokens', `reminder-${safeName(session)}.json`);

/** Writes the reminder file and starts a detached `--remind` process; a later report replaces the file. */
function scheduleReminder(tool, session, log, cache) {
  const mode = process.env.TURN_TOKENS_REMIND ?? 'on';
  if (mode === 'off' || !showsCache(tool, cache)) return;
  const notifyAt = Date.parse(cache.expiresAt) - LEAD_MIN * MIN_MS;
  if (notifyAt <= now().getTime()) return;
  const file = reminderFile(tool, session);
  const rem = { schema: 'turn-tokens/v1', kind: 'cache-reminder', tool, session, log, lastCallAt: cache.at, context: cache.context, expiresAt: cache.expiresAt, notifyAt: new Date(notifyAt).toISOString() };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(rem) + '\n');
  } catch { return; }
  if (mode === 'record') return; // tests: write the file only
  try {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--remind', file], { detached: true, stdio: 'ignore', env: process.env });
    child.unref();
  } catch { /* the report still shows */ }
}

/** The `--remind` process: waits until notifyAt, then notifies unless the reminder was replaced, the session made a newer request, or the cache already expired. */
async function remind(file) {
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
  const mine = read();
  if (!mine || mine.kind !== 'cache-reminder') return;
  // Wait in steps, re-checking at each one, so a reminder that a newer report replaced exits within one step
  // instead of sleeping until its own notifyAt: a session keeps about one waiting process, not one per turn. TT-19
  const stale = () => {
    const current = read();
    if (!current || current.lastCallAt !== mine.lastCallAt) return true; // replaced by a newer report, or removed
    let latest = null;
    try { latest = (mine.tool === 'claude' ? analyzeClaude(mine.log) : analyzeCopilot(mine.log)).cache; } catch { /* log gone: still remind */ }
    return Boolean(latest && latest.at !== mine.lastCallAt); // the session moved on: its cache was refreshed
  };
  let wait = Date.parse(mine.notifyAt) - now().getTime();
  for (;;) {
    if (stale()) return;
    if (wait <= 0) break;
    const step = Math.min(wait, REMIND_POLL_MS);
    await sleep(step);
    wait -= step;
  }
  if (now().getTime() >= Date.parse(mine.expiresAt)) return;
  const left = Math.max(1, Math.round((Date.parse(mine.expiresAt) - now().getTime()) / MIN_MS));
  const title = `${NAME[mine.tool] ?? mine.tool}: cache expires in ${left} min`;
  const body = `${n(mine.context)} tokens cached until ${hhmm(new Date(mine.expiresAt))}. Reply now, or /compact before a longer break.`;
  notify(title, body);
  try { fs.unlinkSync(file); } catch { /* already gone */ }
}

function notify(title, body) {
  if (process.env.TURN_TOKENS_NOTIFY === 'print') { process.stdout.write(`notify · ${title} · ${body}\n`); return; }
  try {
    if (process.platform === 'darwin') execFileSync('osascript', ['-e', `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`], { stdio: 'ignore' });
    else if (process.platform === 'linux') execFileSync('notify-send', [title, body], { stdio: 'ignore' });
  } catch { /* no notifier: nothing to show */ }
}

function statusline() { // TT-12
  let s = {};
  try { s = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return ''; }
  const rl = s.rate_limits ?? null;
  try {
    const dir = path.join(home.claude, 'turn-tokens');
    fs.mkdirSync(dir, { recursive: true });
    const saved = { schema: 'turn-tokens/v1', at: now().toISOString(), session: s.session_id ?? null, contextWindow: s.context_window?.context_window_size ?? null, rateLimits: rl };
    fs.writeFileSync(path.join(dir, `statusline-${safeName(s.session_id ?? 'unknown')}.json`), JSON.stringify(saved) + '\n');
  } catch { /* the line still shows */ }
  const parts = [];
  if (rl?.five_hour) parts.push(`5h ${Math.round(rl.five_hour.used_percentage ?? 0)}%`);
  if (rl?.seven_day) parts.push(`week ${Math.round(rl.seven_day.used_percentage ?? 0)}%`);
  const used = s.context_window?.used_percentage;
  if (used !== null && used !== undefined) parts.push(`context ${Math.round(used)}%`);
  return parts.join(' · ');
}

const tool = opt('--hook');
if (opt('--remind')) {
  await remind(opt('--remind'));
} else if (args.includes('--statusline')) {
  process.stdout.write(statusline() + '\n');
} else if (tool === 'claude' || tool === 'codex' || tool === 'copilot') {
  let text;
  try { text = await hook(tool); } catch (e) { text = `Token report: ${e instanceof Unavailable ? e.message : `failed (${e?.message ?? e})`}`; }
  // Copilot's agentStop output has no message field; its timeline shows {"type":"progress"} lines instead (TT-1).
  const out = args.includes('--text') ? text
    : tool === 'copilot' ? [...text.split('\n').map((line) => JSON.stringify({ type: 'progress', message: line })), '{}'].join('\n')
    : JSON.stringify({ systemMessage: text });
  process.stdout.write(out + '\n');
  process.exitCode = 0;
} else {
  process.stderr.write('usage: turn-tokens.mjs --hook claude|codex|copilot [--text] [--wait-ms <n>] | --statusline | --remind <file>\n');
  process.exitCode = 2;
}
