// Steps that read the repository's own files (not the scenario's temporary copy), for the phase 1 scenarios of specs/022
// (T095 core text, T096 fitness). Every step name starts with "the real" or "in the real" so it never collides with a shared step.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Then } from '@cucumber/cucumber';
import { repo } from '../support/tools.mjs';

function markdownFiles(folder: string, recursive: boolean): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return recursive && entry.name !== 'node_modules' ? markdownFiles(full, true) : [];
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

function hitsIn(folder: string, recursive: boolean, text: string): string[] {
  return markdownFiles(path.join(repo, folder), recursive).flatMap((file) =>
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) => (new RegExp(text).test(line) ? [`${path.relative(repo, file)}:${index + 1}`] : [])),
  );
}

Then('the real folder {string} has no markdown line matching {string}', function (folder: string, text: string) {
  assert.deepEqual(hitsIn(folder, true, text), []);
});

Then('the markdown files directly in the real folder {string} have no line matching {string}', function (folder: string, text: string) {
  assert.deepEqual(hitsIn(folder, false, text), []);
});

Then('the real file {string} has a line containing {string}', function (file: string, text: string) {
  const lines = fs.readFileSync(path.join(repo, file), 'utf8').split('\n');
  assert.ok(
    lines.some((l) => l.includes(text)),
    `${file} has no line containing "${text}"`,
  );
});

function jsonAt(file: string, keyPath: string): unknown {
  const root: unknown = JSON.parse(fs.readFileSync(path.join(repo, file), 'utf8'));
  return keyPath.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], root);
}

Then('the real JSON file {string} lists {string} under {string}', function (file: string, name: string, key: string) {
  const list = jsonAt(file, key);
  assert.ok(Array.isArray(list) && list.includes(name), `${file}: ${key} does not list "${name}"`);
});

Then('in the real JSON file {string}, {string} is {int}', function (file: string, key: string, value: number) {
  assert.equal(jsonAt(file, key), value);
});
