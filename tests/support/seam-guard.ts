// seam-guard.ts — the check that keeps the test seams out of the production installer (specs/022 T118; see the guard
// in the header of fault-adapters.ts, part b).
//
// It reads every non-test source file under the production tiers (installers/ and contracts/) and reports a line that
//   - names a test support file (fault-adapters, installer-world, installer-test-…),
//   - names an AGENT_CONFIG_TEST_ variable,
//   - imports a path under a tests/ folder, or
//   - names a ../tests/ path anywhere on a line, or has a package.json `imports` alias pointing into tests/,
//   - calls import() or require() with something other than a string literal, or uses createRequire, eval( / new Function or
//     new Worker (each could load any file at run time).
// Comments and strings that merely name these paths or words are flagged too (a text scan cannot tell them from code); the
// dynamic proof, the pending scenario T118-10, is the authority. Besides the rules above the scan reads the root package.json for
// an `imports` alias that points into tests/.
// Unit tests (`*.test.ts`) and the folders node_modules and vendor are not production code and are skipped. A tier folder that
// does not exist yet (installers/core before phase 2 lands) has nothing to report.

import fs from 'node:fs';
import path from 'node:path';

export interface SeamLeak {
  /** Path relative to the scanned root, with `/` separators. */
  file: string;
  line: number;
  reason: string;
}

const productionTiers = ['installers', 'contracts'];
const sourceExtensions = new Set(['.ts', '.mts', '.mjs', '.js', '.cjs', '.json', '.sh', '.ps1']);
const skippedFolders = new Set(['node_modules', 'vendor']);

interface Rule {
  pattern: RegExp;
  reason: string;
  /** When true the rule also applies to the repository's root package.json (its `imports` aliases). */
  rootPackage?: boolean;
}

const rules: readonly Rule[] = [
  { pattern: /fault-adapters|installer-world|installer-test-/, reason: 'names a test support file' },
  { pattern: /AGENT_CONFIG_TEST_/, reason: 'names a test environment variable' },
  { pattern: /(?:from|import|require)\s*\(?\s*['"](?:[^'"]*\/)?tests\//, reason: 'imports a path under tests/' },
  { pattern: /\.\.\/tests\//, reason: 'names a ../tests/ path' },
  { pattern: /\bimport\s*\(\s*[^'"\s)]/, reason: 'imports a computed path' },
  { pattern: /\brequire\s*\(\s*[^'"\s)]/, reason: 'requires a computed path' },
  { pattern: /\bcreateRequire\b/, reason: 'uses createRequire' },
  { pattern: /\beval\s*\(|\bnew\s+Function\b/, reason: 'runs code from a string' },
  { pattern: /\bnew\s+Worker\b/, reason: 'starts a worker' },
  { pattern: /"#[^"]+"\s*:\s*"(?:[^"]*\/)?tests\//, reason: 'has an imports alias into tests/', rootPackage: true },
];

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skippedFolders.has(entry.name)) files.push(...sourceFiles(full));
    } else if (sourceExtensions.has(path.extname(entry.name)) && !/\.test\.[cm]?ts$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

/** Every leak under the production tiers of `root`, sorted by file and line. */
export function findSeamLeaks(root: string, tiers: readonly string[] = productionTiers): SeamLeak[] {
  const leaks: SeamLeak[] = [];
  const files = tiers.flatMap((tier) => sourceFiles(path.join(root, tier))).map((file) => ({ file, all: true }));
  const rootPackage = path.join(root, 'package.json');
  if (fs.existsSync(rootPackage)) files.push({ file: rootPackage, all: false });
  for (const { file, all } of files) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    fs.readFileSync(file, 'utf8')
      .split('\n')
      .forEach((text, index) => {
        for (const { pattern, reason, rootPackage: onRoot } of rules) {
          if ((all || onRoot === true) && pattern.test(text)) leaks.push({ file: relative, line: index + 1, reason });
        }
      });
  }
  return leaks.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.reason.localeCompare(b.reason));
}

/** One line per leak: `<file>:<line>: <reason>`. */
export function formatSeamLeaks(leaks: readonly SeamLeak[]): string[] {
  return leaks.map((leak) => `${leak.file}:${leak.line}: ${leak.reason}`);
}
