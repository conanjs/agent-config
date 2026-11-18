#!/usr/bin/env node
// Builds skills and agents for each coding agent from one neutral source (contracts skill-source/v1, agent-source/v1)
// and the adapter field lists (adapters/<name>/fields.yaml, contracts adapter-fields/v1).
//
//   node scripts/build.mjs [--link] [--platform darwin|linux|win32] [--home <dir>]
//
// Sources: skills/<name>/{skill.yaml,body.md} and agents/<name>/{agent.yaml,body.md} in this repo and in every folder
// listed in components.yaml. Output: dist/<adapter>/{agents,skills}/ (gitignored) and dist/manifest.json.
// --link links each built entry into the adapter's folder (per entry, so entries that other tools put there stay).
//
// Body syntax: {{AGENT_HOME}} becomes the installed home for the platform (no per-OS notes in the text);
// {{if <adapter>}}…{{/if}} and {{unless <adapter>}}…{{/unless}} keep text for some adapters only.
// Exit codes: 0 ok, 1 a source or adapter is invalid, 2 usage error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YAML = await import(pathToFileURL(path.join(root, 'contracts/lib/vendor/yaml/index.js')).href);

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HOME_RENDER = { posix: '~/.copilot', win32: '%USERPROFILE%/.copilot' };

function parseArgs(argv) {
  const opts = { link: false, platform: process.platform, home: os.homedir() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--link') opts.link = true;
    else if (a === '--platform') opts.platform = argv[++i];
    else if (a === '--home') opts.home = path.resolve(argv[++i]);
    else if (a === '-h' || a === '--help') {
      process.stdout.write(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport ')[0].replace(/^#!.*\n/, '').replace(/^\/\/ ?/gm, ''));
      process.exit(0);
    } else usage(`unknown option ${a}`);
  }
  if (!['darwin', 'linux', 'win32'].includes(opts.platform)) usage(`--platform must be darwin, linux or win32`);
  return opts;
}

function usage(msg) {
  process.stderr.write(`build.mjs: ${msg}\nUsage: node scripts/build.mjs [--link] [--platform darwin|linux|win32] [--home <dir>]\n`);
  process.exit(2);
}

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);

function readYaml(file) {
  try {
    return YAML.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`${rel(file)}: ${e.message.split('\n')[0]}`);
    return null;
  }
}

const rel = (p) => path.relative(root, p) || '.';

// ---- sources ----------------------------------------------------------------------------------------------------

function componentRoots() {
  const roots = [{ name: 'agent-config', dir: root }];
  const listFile = path.join(root, 'components.yaml');
  const list = fs.existsSync(listFile) ? readYaml(listFile) : null;
  for (const c of list?.components ?? []) {
    const dir = path.resolve(root, c.path);
    if (fs.existsSync(dir)) roots.push({ name: c.name, dir });
    else warnings.push(`component ${c.name}: ${c.path} not found, skipped`);
  }
  return roots;
}

function loadSources(kind, roots) {
  const metaFile = kind === 'skills' ? 'skill.yaml' : 'agent.yaml';
  const schema = kind === 'skills' ? 'skill-source/v1' : 'agent-source/v1';
  const seen = new Map();
  const out = [];
  for (const c of roots) {
    const base = path.join(c.dir, kind);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base).sort()) {
      const dir = path.join(base, name);
      const metaPath = path.join(dir, metaFile);
      if (!fs.existsSync(metaPath)) continue;
      const meta = readYaml(metaPath);
      if (!meta) continue;
      const where = `${c.name}:${kind}/${name}`;
      if (meta.schema !== schema) fail(`${where}: schema must be ${schema}`);
      if (meta.name !== name || !ID.test(name)) fail(`${where}: name must equal the folder name and match ${ID}`);
      if (typeof meta.description !== 'string' || !meta.description.trim()) fail(`${where}: description is required`);
      if (!Array.isArray(meta.targets) || meta.targets.length === 0) fail(`${where}: targets is required`);
      if (seen.has(name)) fail(`${kind} ${name} comes from both ${seen.get(name)} and ${c.name}`);
      seen.set(name, c.name);
      const bodyPath = path.join(dir, 'body.md');
      const body = fs.existsSync(bodyPath) ? fs.readFileSync(bodyPath, 'utf8') : '';
      out.push({ kind, name, meta, body, dir, component: c.name });
    }
  }
  return out;
}

function loadAdapters() {
  const base = path.join(root, 'adapters');
  const adapters = [];
  for (const name of fs.readdirSync(base).sort()) {
    const file = path.join(base, name, 'fields.yaml');
    if (!fs.existsSync(file)) continue;
    const a = readYaml(file);
    if (!a) continue;
    if (a.schema !== 'adapter-fields/v1' || a.adapter !== name) fail(`${rel(file)}: schema adapter-fields/v1 and adapter: ${name} required`);
    for (const f of a.fields ?? []) if (!f.verified || !f.source) fail(`${rel(file)}: field ${f.name} needs source and verified`);
    adapters.push(a);
  }
  return adapters;
}

// ---- rendering --------------------------------------------------------------------------------------------------

function renderBody(body, adapter, platform) {
  let text = body
    .replace(/\{\{if ([a-z0-9-]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, a, t) => (a === adapter ? t : ''))
    .replace(/\{\{unless ([a-z0-9-]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_, a, t) => (a === adapter ? '' : t))
    .replaceAll('{{AGENT_HOME}}', platform === 'win32' ? HOME_RENDER.win32 : HOME_RENDER.posix);
  const left = text.match(/\{\{\/?(if|unless)\b[^}]*\}\}/);
  if (left) fail(`unbalanced ${left[0]}`);
  return text.trimEnd() + '\n';
}

// The fields an adapter adds for one source, in the adapter's order.
function adapterFields(adapter, kind, meta) {
  const applies = kind === 'skills' ? 'skill' : 'agent';
  const out = [];
  for (const f of adapter.fields ?? []) {
    if (f['applies-to'] !== applies) continue;
    const [[srcKey, want]] = Object.entries(f.from);
    const v = meta[srcKey];
    if (v === undefined) continue;
    if (Array.isArray(want) ? want.length > 0 && !want.includes(v) : v !== want) continue;
    const value = f.values ? f.values[v] : f.value !== undefined ? f.value : v;
    if (value === undefined) continue;
    out.push([f.key ?? f.name, value]);
  }
  for (const [k, v] of Object.entries(meta.platforms?.[adapter.adapter] ?? {})) out.push([k, v]);
  return out;
}

const yamlScalar = (v) =>
  typeof v === 'string' ? (/^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/.test(v) && !/^(true|false|null|yes|no)$/i.test(v) ? v : JSON.stringify(v)) : String(v);
const yamlValue = (v) => (Array.isArray(v) ? `[${v.map(yamlScalar).join(', ')}]` : yamlScalar(v));

function renderMarkdown(src, fields, body) {
  const head = [`name: ${src.name}`, `description: ${JSON.stringify(src.meta.description)}`, ...fields.map(([k, v]) => `${k}: ${yamlValue(v)}`)];
  return `---\n${head.join('\n')}\n---\n\n${body}`;
}

function renderToml(src, fields, body) {
  if (body.includes("'''")) fail(`${src.name}: body contains ''' and cannot be a TOML literal string`);
  const lines = [`name = ${JSON.stringify(src.name)}`, `description = ${JSON.stringify(src.meta.description)}`];
  for (const [k, v] of fields) lines.push(`${k} = ${JSON.stringify(v)}`);
  return `${lines.join('\n')}\ndeveloper_instructions = '''\n${body}'''\n`;
}

// ---- build ------------------------------------------------------------------------------------------------------

function build(opts) {
  const roots = componentRoots();
  const adapters = loadAdapters();
  const sources = [...loadSources('skills', roots), ...loadSources('agents', roots)];
  const dist = path.join(root, 'dist');
  const entries = []; // { adapter, kind, name, folder, entry, file }
  const byFolder = new Map(); // folder/entry -> rendered text, so two adapters sharing a folder agree

  if (errors.length) return { entries, adapters };
  fs.rmSync(dist, { recursive: true, force: true });

  for (const a of adapters) {
    for (const kind of ['skills', 'agents']) {
      const target = a.targets?.[kind];
      if (!target) continue;
      for (const src of sources.filter((s) => s.kind === kind)) {
        const wanted = kind === 'skills' ? (src.meta.targets.includes(a.adapter === 'claude' ? 'claude' : 'agents')) : src.meta.targets.includes(a.adapter);
        if (!wanted) continue;
        const body = renderBody(src.body, a.adapter, opts.platform);
        const fields = adapterFields(a, kind, src.meta);
        const text = target.format === 'toml' ? renderToml(src, fields, body) : renderMarkdown(src, fields, body);
        const relFile = target.file.replace('{name}', src.name);
        const entry = relFile.split('/')[0];
        const key = `${target.folder}/${relFile}`;
        if (byFolder.has(key)) {
          const prev = byFolder.get(key);
          if (prev.text !== text) fail(`${key}: adapters ${prev.adapter} and ${a.adapter} render it differently`);
          continue; // linked from the first adapter's output
        }
        const out = path.join(dist, a.adapter, kind, relFile);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, text);
        // Copy references/ and any other files of a skill next to its SKILL.md.
        if (kind === 'skills') {
          for (const f of fs.readdirSync(src.dir)) {
            if (f === 'skill.yaml' || f === 'body.md') continue;
            fs.cpSync(path.join(src.dir, f), path.join(path.dirname(out), f), { recursive: true });
          }
        }
        byFolder.set(key, { adapter: a.adapter, text });
        entries.push({ adapter: a.adapter, kind, name: src.name, folder: target.folder, entry, link: path.join(dist, a.adapter, kind, entry), keep: target.keep ?? [], descChars: src.meta.description.length, bytes: Buffer.byteLength(text) });
      }
    }
  }
  fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify({ platform: opts.platform, entries: entries.map(({ keep, ...e }) => ({ ...e, link: rel(e.link) })) }, null, 2) + '\n');
  return { entries, adapters };
}

// ---- link -------------------------------------------------------------------------------------------------------

function link(entries, opts) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
  const backup = path.join(opts.home, '.agent-config-backups', `${stamp}-build`);
  const notes = [];
  const expand = (f) => path.join(opts.home, f.replace(/^~\//, ''));
  const ours = (target) => {
    const t = path.resolve(target);
    return [path.join(root, 'dist'), path.join(root, 'claude'), path.join(root, 'codex'), path.join(root, 'copilot'), path.join(root, 'skills')].some((p) => t === p || t.startsWith(p + path.sep));
  };
  const folders = [...new Set(entries.map((e) => e.folder))];
  for (const folder of folders) {
    const dir = expand(folder);
    const keep = [...new Set(entries.filter((e) => e.folder === folder).flatMap((e) => e.keep))];
    // An old whole-folder link becomes a real folder; the kept entries (for example Claude's synced/) move into it.
    if (fs.lstatSync(dir, { throwIfNoEntry: false })?.isSymbolicLink()) {
      const old = safeRealpath(dir);
      notes.push(`${dir} -> ${fs.readlinkSync(dir)}`);
      fs.unlinkSync(dir);
      fs.mkdirSync(dir, { recursive: true });
      for (const k of keep) if (old && fs.existsSync(path.join(old, k))) fs.renameSync(path.join(old, k), path.join(dir, k));
    }
    fs.mkdirSync(dir, { recursive: true });
    const wanted = new Set(entries.filter((e) => e.folder === folder).map((e) => e.entry));
    for (const e of entries.filter((x) => x.folder === folder)) {
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
    // Links this build made earlier (or the old whole-folder layout) whose source is gone.
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

function safeRealpath(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

// ---- main -------------------------------------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));
const { entries, adapters } = build(opts);
for (const w of warnings) process.stderr.write(`warn  ${w}\n`);
if (errors.length) {
  for (const e of errors) process.stderr.write(`error ${e}\n`);
  process.exit(1);
}
// What each coding agent sees: its agents and the skills in its skills folder (a shared folder is built once).
for (const a of adapters) {
  const seen = entries.filter(
    (e) => (e.kind === 'agents' && e.adapter === a.adapter) || (e.kind === 'skills' && e.folder === a.targets?.skills?.folder),
  );
  const n = (k) => seen.filter((e) => e.kind === k).length;
  const bytes = seen.reduce((s, e) => s + e.bytes, 0);
  const listed = seen.reduce((s, e) => s + e.descChars, 0);
  process.stdout.write(`${a.adapter}: ${n('agents')} agents, ${n('skills')} skills, ${bytes} bytes, ${listed} description chars listed\n`);
}
if (opts.link) {
  const notes = link(entries, opts);
  process.stdout.write(`linked ${entries.length} entries${notes.length ? `; ${notes.length} change(s) recorded in ~/.agent-config-backups/*-build/links-before.txt` : ''}\n`);
}
