#!/usr/bin/env node
// Builds agents for each coding agent and, with --link, links them into that agent's folders. Skills are not built
// here: they ship in plugin/ as one SKILL.md for every coding agent (see AGENTS.md).
//
//   node scripts/build.mjs [--link] [--platform darwin|linux|win32] [--home <dir>]
//
// A source is a folder skills/<name>/ or agents/<name>/ in this repo with
// body.md, the text every coding agent shares, and one header file per coding agent that gets it: claude.yaml,
// copilot.yaml, codex.yaml (skills) or codex.toml (Codex agents), each written in that agent's own keys. There is no
// common header: a coding agent without a header file in the folder does not get that skill or agent.
// adapters/<agent>/adapter.yaml says the header file's name, where the built file goes and which keys are checked.
//
// Body syntax: {{AGENT_HOME}} becomes the installed home for the platform (no per-OS notes in the text);
// {{if <agent>}}…{{/if}} and {{unless <agent>}}…{{/unless}} keep text for some coding agents only.
// Output: dist/<agent>/{skills,agents}/ (gitignored) and dist/manifest.json.
// Exit codes: 0 ok, 1 a source or adapter is invalid, 2 usage error.
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YAML = await import(pathToFileURL(path.join(root, 'contracts/lib/vendor/yaml/index.js')).href);

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HOME_RENDER = { posix: '~/.agent-config', win32: '%USERPROFILE%/.agent-config' };
const KINDS = ['skills', 'agents'];

function parseArgs(argv) {
  const opts = { link: false, platform: process.platform, home: os.homedir() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--link') opts.link = true;
    else if (a === '--platform') opts.platform = argv[++i];
    else if (a === '--home') opts.home = path.resolve(argv[++i]);
    else if (a === '-h' || a === '--help') {
      const text = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
      process.stdout.write(text.split('\nimport ')[0].replace(/^#!.*\n/, '').replace(/^\/\/ ?/gm, ''));
      process.exit(0);
    } else usage(`unknown option ${a}`);
  }
  if (!['darwin', 'linux', 'win32'].includes(opts.platform)) usage('--platform must be darwin, linux or win32');
  return opts;
}

function usage(msg) {
  process.stderr.write(`build.mjs: ${msg}\nUsage: node scripts/build.mjs [--link] [--platform darwin|linux|win32] [--home <dir>]\n`);
  process.exit(2);
}

const errors = [];
const warnings = [];
const rel = (p) => path.relative(root, p) || '.';

function readYaml(file) {
  try {
    return YAML.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`${rel(file)}: ${e.message.split('\n')[0]}`);
    return null;
  }
}

// ---- inputs -----------------------------------------------------------------------------------------------------

function loadAdapters() {
  const base = path.join(root, 'adapters');
  const out = [];
  for (const name of fs.readdirSync(base).sort()) {
    const file = path.join(base, name, 'adapter.yaml');
    if (!fs.existsSync(file)) continue;
    const a = readYaml(file);
    if (!a) continue;
    if (a.adapter !== name) errors.push(`${rel(file)}: adapter must be ${name}`);
    for (const kind of KINDS) {
      const t = a[kind];
      if (!t) continue;
      for (const k of ['folder', 'file', 'header', 'format']) if (!t[k]) errors.push(`${rel(file)}: ${kind}.${k} is required`);
      if (t.format && !['markdown', 'toml'].includes(t.format)) errors.push(`${rel(file)}: ${kind}.format must be markdown or toml`);
    }
    out.push(a);
  }
  return out;
}

// Only this repo's sources: another component is integrated by a line in the core instructions, not by this build.
function componentRoots() {
  return [{ name: 'agent-config', dir: root }];
}

function loadSources(roots) {
  const seen = new Map();
  const out = [];
  for (const c of roots) {
    for (const kind of KINDS) {
      const base = path.join(c.dir, kind);
      if (!fs.existsSync(base)) continue;
      for (const name of fs.readdirSync(base).sort()) {
        const dir = path.join(base, name);
        const bodyPath = path.join(dir, 'body.md');
        if (!fs.existsSync(bodyPath)) continue;
        const where = `${c.name}:${kind}/${name}`;
        if (!ID.test(name)) errors.push(`${where}: a folder name must match ${ID}`);
        const key = `${kind}/${name}`;
        if (seen.has(key)) errors.push(`${key} comes from both ${seen.get(key)} and ${c.name}`);
        seen.set(key, c.name);
        out.push({ kind, name, dir, where, body: fs.readFileSync(bodyPath, 'utf8') });
      }
    }
  }
  return out;
}

// ---- headers ----------------------------------------------------------------------------------------------------

// The header as written, without comment lines: comments cost tokens in every session and help no agent.
const stripComments = (text) =>
  text
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')
    .trim();

// Top-level keys and the name of a header, to check it; the text itself is emitted unchanged.
function headerKeys(text, format, where) {
  if (format === 'toml') {
    const keys = [...text.matchAll(/^([A-Za-z0-9_-]+)\s*=/gm)].map((m) => m[1]);
    const name = text.match(/^name\s*=\s*"([^"]*)"/m)?.[1];
    const description = text.match(/^description\s*=\s*"((?:[^"\\]|\\.)*)"/m)?.[1];
    if (/^\[/m.test(text)) errors.push(`${where}: a TOML table would swallow developer_instructions; keep tables out of the header`);
    return { keys, name, description };
  }
  let data;
  try {
    data = YAML.parse(text);
  } catch (e) {
    errors.push(`${where}: ${e.message.split('\n')[0]}`);
    return { keys: [] };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push(`${where}: the header must be a YAML mapping`);
    return { keys: [] };
  }
  return { keys: Object.keys(data), name: data.name, description: data.description };
}

// ---- rendering --------------------------------------------------------------------------------------------------

function renderBody(body, adapter, platform, where) {
  const text = body
    .replace(/\{\{if ([a-z0-9-]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, a, t) => (a === adapter ? t : ''))
    .replace(/\{\{unless ([a-z0-9-]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_, a, t) => (a === adapter ? '' : t))
    .replaceAll('{{AGENT_HOME}}', platform === 'win32' ? HOME_RENDER.win32 : HOME_RENDER.posix);
  const left = text.match(/\{\{\/?(if|unless)\b[^}]*\}\}/);
  if (left) errors.push(`${where}: unbalanced ${left[0]}`);
  return text.trimEnd() + '\n';
}

function render(format, header, body, where) {
  if (format === 'toml') {
    if (body.includes("'''")) errors.push(`${where}: body contains ''' and cannot be a TOML literal string`);
    return `${header}\ndeveloper_instructions = '''\n${body}'''\n`;
  }
  return `---\n${header}\n---\n\n${body}`;
}

// ---- build ------------------------------------------------------------------------------------------------------

function build(opts) {
  const adapters = loadAdapters();
  const sources = loadSources(componentRoots());
  const entries = [];
  if (errors.length) return { entries, adapters };

  const dist = path.join(root, 'dist');
  fs.rmSync(dist, { recursive: true, force: true });
  const byTarget = new Map(); // "<folder>/<file>" -> adapter, so two adapters never write the same installed file

  for (const a of adapters) {
    for (const kind of KINDS) {
      const t = a[kind];
      if (!t) continue;
      for (const src of sources.filter((s) => s.kind === kind)) {
        const headerFile = path.join(src.dir, t.header);
        if (!fs.existsSync(headerFile)) continue; // this coding agent does not get it
        const where = `${src.where}/${t.header}`;
        const header = stripComments(fs.readFileSync(headerFile, 'utf8'));
        const { keys, name, description } = headerKeys(header, t.format, where);
        if (name !== src.name) errors.push(`${where}: name must be "${src.name}" (the folder name)`);
        if (typeof description !== 'string' || !description.trim()) errors.push(`${where}: description is required`);
        if (keys.includes('developer_instructions')) errors.push(`${where}: developer_instructions comes from body.md`);
        const unknown = keys.filter((k) => !(t.keys ?? []).includes(k));
        if (unknown.length) warnings.push(`${where}: ${unknown.join(', ')} not in adapters/${a.adapter}/adapter.yaml keys (check the docs, then add)`);

        const text = render(t.format, header, renderBody(src.body, a.adapter, opts.platform, src.where), where);
        const relFile = t.file.replace('{name}', src.name);
        const target = `${t.folder}/${relFile}`;
        if (byTarget.has(target)) errors.push(`${target}: written by both ${byTarget.get(target)} and ${a.adapter}`);
        byTarget.set(target, a.adapter);

        const out = path.join(dist, a.adapter, kind, relFile);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, text);
        if (kind === 'skills') {
          // Everything else in a skill folder (references/, scripts) ships next to its SKILL.md; headers do not.
          for (const f of fs.readdirSync(src.dir)) {
            if (f === 'body.md' || /^(claude|copilot|codex)\.(ya?ml|toml)$/.test(f)) continue;
            fs.cpSync(path.join(src.dir, f), path.join(path.dirname(out), f), { recursive: true });
          }
        }
        const entry = relFile.split('/')[0];
        entries.push({ adapter: a.adapter, kind, name: src.name, folder: t.folder, entry, link: path.join(dist, a.adapter, kind, entry), keep: t.keep ?? [], descChars: description?.length ?? 0, bytes: Buffer.byteLength(text) });
      }
    }
  }
  const manifest = entries.map((e) => ({ adapter: e.adapter, kind: e.kind, name: e.name, folder: e.folder, entry: e.entry, link: rel(e.link), bytes: e.bytes }));
  fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify({ platform: opts.platform, entries: manifest }, null, 2) + '\n');
  return { entries, adapters };
}

// ---- link -------------------------------------------------------------------------------------------------------

function safeRealpath(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

function link(entries, opts) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
  const backup = path.join(opts.home, '.agent-config-backups', `${stamp}-build`);
  const notes = [];
  const expand = (f) => path.join(opts.home, f.replace(/^~\//, ''));
  // Links this build owns: into dist/, or into the folders of the old whole-folder layout.
  const ours = (target) =>
    ['dist', 'claude', 'codex', 'copilot', 'skills'].some((d) => {
      const p = path.join(root, d);
      return target === p || target.startsWith(p + path.sep);
    });
  for (const folder of [...new Set(entries.map((e) => e.folder))]) {
    const dir = expand(folder);
    const mine = entries.filter((e) => e.folder === folder);
    const keep = [...new Set(mine.flatMap((e) => e.keep))];
    // An old whole-folder link becomes a real folder; the kept entries (for example Claude's synced/) move into it.
    if (fs.lstatSync(dir, { throwIfNoEntry: false })?.isSymbolicLink()) {
      const old = safeRealpath(dir);
      notes.push(`${dir} -> ${fs.readlinkSync(dir)}`);
      fs.unlinkSync(dir);
      fs.mkdirSync(dir, { recursive: true });
      for (const k of keep) if (old && fs.existsSync(path.join(old, k))) fs.renameSync(path.join(old, k), path.join(dir, k));
    }
    fs.mkdirSync(dir, { recursive: true });
    for (const e of mine) {
      const dest = path.join(dir, e.entry);
      const st = fs.lstatSync(dest, { throwIfNoEntry: false });
      if (st?.isSymbolicLink()) fs.unlinkSync(dest);
      else if (st) {
        fs.mkdirSync(backup, { recursive: true });
        fs.renameSync(dest, path.join(backup, `${path.basename(dir)}-${e.entry}`));
        notes.push(`${dest} (real ${st.isDirectory() ? 'folder' : 'file'}) moved to ${backup}`);
      }
      const isDir = fs.statSync(e.link).isDirectory();
      try {
        fs.symlinkSync(e.link, dest, isDir ? (opts.platform === 'win32' ? 'junction' : 'dir') : 'file');
      } catch (err) {
        if (opts.platform !== 'win32') throw err;
        fs.cpSync(e.link, dest, { recursive: true }); // Windows without symlink rights: a copy, refreshed by the next build
      }
    }
    const wanted = new Set(mine.map((e) => e.entry));
    for (const name of fs.readdirSync(dir)) {
      if (wanted.has(name)) continue;
      const p = path.join(dir, name);
      if (fs.lstatSync(p).isSymbolicLink() && ours(path.resolve(dir, fs.readlinkSync(p)))) {
        fs.unlinkSync(p);
        notes.push(`removed stale link ${p}`);
      }
    }
  }
  if (notes.length) {
    fs.mkdirSync(backup, { recursive: true });
    fs.appendFileSync(path.join(backup, 'links-before.txt'), notes.join('\n') + '\n');
  }
  return notes;
}

// ---- main -------------------------------------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));
const { entries, adapters } = build(opts);
for (const w of warnings) process.stderr.write(`warn  ${w}\n`);
if (errors.length) {
  for (const e of errors) process.stderr.write(`error ${e}\n`);
  process.exit(1);
}
for (const a of adapters) {
  const mine = entries.filter((e) => e.adapter === a.adapter);
  const n = (k) => mine.filter((e) => e.kind === k).length;
  const bytes = mine.reduce((s, e) => s + e.bytes, 0);
  const listed = mine.reduce((s, e) => s + e.descChars, 0);
  process.stdout.write(`${a.adapter}: ${n('agents')} agents, ${n('skills')} skills, ${bytes} bytes, ${listed} description chars listed\n`);
}
if (opts.link) {
  const notes = link(entries, opts);
  process.stdout.write(`linked ${entries.length} entries${notes.length ? `; ${notes.length} change(s) recorded in ~/.agent-config-backups/*-build/links-before.txt` : ''}\n`);
}
