// gherkin.mjs — reads the subset of Gherkin this repo's scenario files use and runs them with node:test.
//
// Supported: Feature, Background, Scenario, Given/When/Then/And/But steps, """ doc strings, # comments.
// Not supported (fails loudly): Scenario Outline, Examples, tables, tags, Rule.
// Why not Cucumber.js: it needs npm install, and this repo's tools run on plain Node (specs/001 research.md, DR-001).
//
// Usage from a test file:
//   import { runFeature } from '../lib/gherkin.mjs';
//   runFeature(featurePath, [[/^the file "(.+)" is removed$/, (ctx, file) => { … }], …], { setup, teardown });

import fs from 'node:fs';
import { test } from 'node:test';

const KEYWORD = /^(Given|When|Then|And|But) (.+)$/;

/**
 * Parses a feature file into { name, background: steps[], scenarios: [{ name, line, steps[] }] }.
 * A step is { keyword, text, docString?, line }.
 */
export function parseFeature(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
  const feature = { name: '', background: [], scenarios: [] };
  let steps = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const where = `${file}:${i + 1}`;
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('"""')) {
      const step = steps?.at(-1);
      if (!step) throw new Error(`${where}: doc string without a step`);
      const indent = raw.indexOf('"""');
      const body = [];
      for (i++; i < lines.length && lines[i].trim() !== '"""'; i++) body.push(lines[i].slice(Math.min(indent, lines[i].search(/\S|$/))));
      if (i >= lines.length) throw new Error(`${where}: doc string is not closed`);
      step.docString = body.join('\n');
      continue;
    }
    let m;
    if ((m = line.match(/^Feature: (.+)$/))) { feature.name = m[1]; steps = null; continue; }
    if (line === 'Background:') { steps = feature.background; continue; }
    if ((m = line.match(/^Scenario: (.+)$/))) { steps = []; feature.scenarios.push({ name: m[1], line: i + 1, steps }); continue; }
    if ((m = line.match(KEYWORD))) {
      if (!steps) throw new Error(`${where}: step outside a Background or Scenario`);
      steps.push({ keyword: m[1], text: m[2], line: i + 1 });
      continue;
    }
    if (/^(Scenario Outline|Examples|Rule):|^@|^\|/.test(line)) throw new Error(`${where}: "${line}" is Gherkin this runner does not support`);
    if (steps === null && feature.scenarios.length === 0) continue; // free-text feature description
    throw new Error(`${where}: cannot parse "${line}"`);
  }
  return feature;
}

/** Finds the one step definition whose pattern matches the whole step text. */
function match(defs, step) {
  const hits = defs.map(([re, fn]) => [step.text.match(re), fn]).filter(([m]) => m);
  if (hits.length === 0) throw new Error(`line ${step.line}: no step definition matches "${step.keyword} ${step.text}"`);
  if (hits.length > 1) throw new Error(`line ${step.line}: more than one step definition matches "${step.text}"`);
  const [[m, fn]] = hits;
  return () => fn(...m.slice(1), step.docString);
}

/**
 * Registers one node:test test per scenario. `world()` builds a fresh context per scenario; `defs(ctx)`
 * returns that context's step definitions; `cleanup(ctx)` always runs after the scenario.
 */
export function runFeature(file, { world, defs, cleanup }) {
  const feature = parseFeature(file);
  for (const sc of feature.scenarios) {
    test(sc.name, async () => {
      const ctx = await world();
      try {
        const d = defs(ctx);
        for (const step of [...feature.background, ...sc.steps]) await match(d, step)();
      } finally {
        await cleanup?.(ctx);
      }
    });
  }
  return feature;
}
