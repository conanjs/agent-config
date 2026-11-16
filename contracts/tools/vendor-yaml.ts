// Copies the pure-ESM build of the locked `yaml` package into contracts/lib/vendor/yaml/ (specs/022 T054, DR-102, DR-304).
// Run it after changing the pinned version: `node contracts/tools/vendor-yaml.ts`. The unit test of contracts/lib/yaml.ts
// compares the copy with the locked package, so a copy that drifted fails there. It is a tool, so it does file I/O.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const contractsDir = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(contractsDir, '..');

/** Where the locked package sits after `pnpm install`. */
export const lockedYamlDir = path.join(repoRoot, 'node_modules', 'yaml');

/** Where the vendored copy lives (DR-304: contracts/lib/vendor/yaml). */
export const vendoredYamlDir = path.join(contractsDir, 'lib', 'vendor', 'yaml');

/** Files that belong to the vendored folder without being part of `browser/dist/` of the package. */
export const vendorExtraFiles: readonly string[] = ['LICENSE', 'index.d.ts'];

/**
 * Lists the files of a folder tree.
 *
 * @param dir - the folder to walk
 * @returns every file under `dir` as a path relative to it with `/` separators, sorted
 */
export function listFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

/**
 * Compares the vendored folder with the locked package, byte for byte.
 *
 * @param lockedDir - the folder of the installed `yaml` package
 * @param vendoredDir - the vendored copy
 * @returns one sentence per difference: a missing, extra or changed file; empty when the copy is exact
 */
export function compareVendoredYaml(lockedDir: string, vendoredDir: string): string[] {
  const distDir = path.join(lockedDir, 'browser', 'dist');
  const expected = new Map(listFiles(distDir).map((file): [string, string] => [file, path.join(distDir, file)]));
  expected.set('LICENSE', path.join(lockedDir, 'LICENSE'));
  const actual = new Set(listFiles(vendoredDir));
  const differences: string[] = [];
  for (const [file, source] of expected) {
    if (!actual.has(file)) differences.push(`missing in the copy: ${file}`);
    else if (!fs.readFileSync(source).equals(fs.readFileSync(path.join(vendoredDir, file))))
      differences.push(`differs from the locked package: ${file}`);
  }
  for (const file of actual) {
    if (!expected.has(file) && !vendorExtraFiles.includes(file)) differences.push(`not in the locked package: ${file}`);
  }
  return differences;
}

/**
 * Replaces the vendored folder with `browser/dist/` and the LICENSE of the locked package, keeping the type file.
 *
 * @param lockedDir - the folder of the installed `yaml` package
 * @param vendoredDir - the folder to write
 */
export function vendorYaml(lockedDir: string, vendoredDir: string): void {
  const typeFile = path.join(vendoredDir, 'index.d.ts');
  const keptTypes = fs.existsSync(typeFile) ? fs.readFileSync(typeFile) : undefined;
  fs.rmSync(vendoredDir, { recursive: true, force: true });
  fs.cpSync(path.join(lockedDir, 'browser', 'dist'), vendoredDir, { recursive: true });
  fs.copyFileSync(path.join(lockedDir, 'LICENSE'), path.join(vendoredDir, 'LICENSE'));
  if (keptTypes) fs.writeFileSync(typeFile, keptTypes);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  vendorYaml(lockedYamlDir, vendoredYamlDir);
  process.stdout.write(`vendored yaml into ${path.relative(repoRoot, vendoredYamlDir)}\n`);
}
