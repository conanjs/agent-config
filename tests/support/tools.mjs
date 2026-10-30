// tools.mjs — the registry of tools under test. Each tests/<tool>/tool.mjs registers one entry:
//
//   registerTool('<name>', {
//     fixture: 'tests/<name>/fixtures/base',         // copied into a fresh temp folder per scenario
//     run: (world, extraArgs) => ({ file, args, env }), // the process to start; env is merged into process.env
//     header: /^…/,                                     // optional: first output line, checked and dropped
//     normalize: [[/regex/g, 'text']],                  // optional: replacements for unstable output (counts of days, …)
//     quietPass: '…',                                   // output after the header for a clean pass
//     codes: () => ['KD-1', …],                         // every rule code the tool can print
//     rules: 'copilot/…/schemas',                       // optional: folder whose `| <code> |` rows define those codes
//   });

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tools = new Map();

export function registerTool(name, def) {
  if (tools.has(name)) throw new Error(`tool "${name}" registered twice`);
  tools.set(name, def);
}

export function getTool(name) {
  const t = tools.get(name);
  if (!t) throw new Error(`no tool "${name}" registered (known: ${[...tools.keys()].join(', ')})`);
  return t;
}

/** Rule codes from `fail('CODE', …)` / `warn('CODE', …)` calls, including `(cond ? 'A' : 'B', …)` and `(x ? warn : fail)('C', …)`. */
export function codesFromCalls(file, fns = ['fail', 'warn']) {
  const src = fs.readFileSync(path.join(repo, file), 'utf8');
  const codes = new Set();
  const re = new RegExp(`\\b(?:${fns.join('|')})\\)?\\(([^,]+),`, 'g');
  for (const m of src.matchAll(re)) for (const c of m[1].matchAll(/'([A-Z][A-Z0-9-]*)'/g)) codes.add(c[1]);
  if (codes.size < 3) throw new Error(`found only ${codes.size} rule codes in ${file}; the extraction pattern no longer matches it`);
  return [...codes].sort();
}
