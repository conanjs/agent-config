// TSN-13 link check: every {@link X} in a doc comment must resolve, as the editor resolves it, or a
// reader clicks on plain text. tsc does not report a broken link; this asks the language service the
// same question an editor asks (go to definition) for every link in the tsconfig's files.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile).config;
const { fileNames, options } = ts.parseJsonConfigFileContent(config, ts.sys, root);
const service = ts.createLanguageService({
  getScriptFileNames: () => fileNames,
  getScriptVersion: () => "1",
  getScriptSnapshot: (file) =>
    fs.existsSync(file) ? ts.ScriptSnapshot.fromString(fs.readFileSync(file, "utf8")) : undefined,
  getCurrentDirectory: () => root,
  getCompilationSettings: () => options,
  getDefaultLibFileName: ts.getDefaultLibFilePath,
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
});

let links = 0;
const broken = [];
for (const file of fileNames) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(/\{@link\s+([A-Za-z_$][\w$.]*)/g)) {
    links += 1;
    const name = match[1];
    // Ask at the last segment, so `Port.member` resolves the member, not only `Port`.
    const at = match.index + match[0].length - 1;
    if ((service.getDefinitionAtPosition(file, at) ?? []).length === 0) {
      const line = text.slice(0, match.index).split("\n").length;
      broken.push(`${path.relative(root, file)}:${line} {@link ${name}}`);
    }
  }
}

if (broken.length > 0) {
  process.stderr.write(
    `${broken.length} unresolved {@link}: import the target, or link only what this file depends on (TSN-13)\n` +
      broken.map((b) => `  ${b}\n`).join(""),
  );
  process.exit(1);
}
process.stdout.write(`${links} {@link} tags resolve\n`);
