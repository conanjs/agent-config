// The one message catalogue of the installer (TR-5; installer-cli.md, "Messages"): every text the installer prints is a row here and
// nowhere else, keyed by the id of that table. `{name}` marks a value the caller supplies; text in angle brackets such as
// `<name> <source>` is printed as written. Rows that share an id with a suffix are lines or parts of the same message.
// A value is escaped by `renderMessage` (control characters shown, LF too), so `MG-32.cause`, which carries git's standard error
// (piped by the git adapter of T133, never inherited), prints as one line. MG-39.old-agent-home-path names the old Copilot folder on
// purpose, as a warning to V; scripts/copilot-paths.yaml records that one line.

/** Every installer message, by id; the type of each row's placeholders is read from its text by `renderMessage`. */
export const MESSAGE_CATALOG = {
  'MG-01': 'agent home: {home} ({source}, {confirmation})',
  'MG-01.move': 'agent home: {home} ({source}, not confirmed; recorded home: {recordedHome})',
  'MG-02': 'status: {status}',
  'MG-03': '{number}. {kind}: {item}',
  'MG-03.detail': '   {detail}',
  'MG-03.satisfy': '   satisfy: {command}',
  'MG-03.proposal': '   proposal: {text}',
  'MG-03.origin': '   component: {component}, commit: {commit}',
  'MG-04': '{number}. home: {home}',
  'MG-04.detail': '   confirm the agent home',
  'MG-04.satisfy': '   satisfy: install (interactive) and answer yes',
  'MG-05.detail': '   confirm moving the agent home from {oldHome} to {newHome}',
  'MG-06': '{number}. components: slot {slot}',
  'MG-06.detail': '   contract {contract}, no provider',
  'MG-06.satisfy': '   satisfy: add <name> <source>',
  'MG-07': '   suggested by {component}, unverified: {source}',
  'MG-08': '{number}. variables: {name}',
  'MG-08.detail': '   {description} (declared by {component})',
  'MG-08.satisfy': '   satisfy: set {name}=<value>',
  'MG-09': '{number}. privileged: {item}',
  'MG-09.hook': 'hook {id} ({agents}, {event})',
  'MG-09.route': 'route {id}',
  'MG-09.route-detail': '   when: {when}; read: {read}',
  'MG-09.service': 'service {name} ({kind})',
  'MG-09.service-detail': '   {command} {args}',
  'MG-09.satisfy': '   satisfy: install (interactive) and approve',
  'MG-10':
    '   an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted',
  'MG-11.home': 'use {home} as the agent home? (yes/no)',
  'MG-11.move': 'move the agent home from {oldHome} to {newHome}? (yes/no)',
  'MG-11.privileged': 'approve these privileged changes? (yes/no)',
  'MG-12':
    'usage: agent-config <command> [options]; commands: install, plan, doctor, set, add, use, init-component, uninstall',
  'MG-13.none':
    'needs: Node 24.12 or later (none found). Install Node 24 from https://nodejs.org/ or set NODE to its path, then run install again.',
  'MG-13.found':
    'needs: Node 24.12 or later (found {version}). Install Node 24 from https://nodejs.org/ or set NODE to its path, then run install again.',
  'MG-14.git': 'component {name}: git {url} {ref} at {commit}',
  'MG-14.path': 'component {name}: path {path} (live)',
  'MG-15': 'updated {name}: {from}..{to}',
  'MG-16': 'wrote {folder}/component.yaml',
  'MG-17': 'stored {name} in {path}',
  'MG-18': 'backup: {path}',
  'MG-19.retired': 'retired: {path}',
  'MG-19.not-own': "left: {path}: not the installer's own link",
  'MG-19.kept': 'kept: {path}: used by a hook command',
  'MG-19.edited': 'left: {path}: edited since install',
  'MG-20': 'override: {name}: local source {local} replaces public source {public}',
  'MG-21': 'warning: component {name} is skipped: {reason}',
  'MG-21.archive': 'source type archive not supported in this release',
  'MG-21.no-manifest': 'no component.yaml in {folder}',
  'MG-21.unknown-slot': 'slot {slot} is not in slots/v1',
  'MG-21.invalid': 'component.yaml is invalid: {sentence}',
  'MG-21.symlink': 'symlink {path} leaves the component root',
  'MG-22': 'warning: component {name} has submodules; they are ignored',
  'MG-23': 'error: {list} is invalid: {sentence}',
  'MG-24': 'error: dependency cycle: {cycle}',
  'MG-25': 'error: {consumer} needs {contract} from slot {slot}, but {provider} offers {offered}',
  'MG-26': 'error: {consumer}: {file} cites {path}, which {provider} does not export',
  'MG-27':
    'error: slot {slot} allows one provider but {first} and {second} both fill it; pick one with: use <name> <source>',
  'MG-28': 'error: component {name} needs node {range}, found {version}',
  'MG-29': 'error: tag moved: component {name}, tag {tag}, locked {locked}, now {current}',
  'MG-30': 'error: another run holds the lock {lock} ({command}, started {started})',
  'MG-31': 'error: component {name}: path source folder {folder} does not exist',
  'MG-32': 'error: component {name}: cannot fetch git source {url} (ref {ref})',
  'MG-32.cause': '   cause: {cause}',
  'MG-33': 'error: {folder}/component.yaml already exists; init-component never overwrites a manifest',
  'MG-34':
    "error: component {name} has a source URL with credentials; keep credentials in git's credential helper or ssh-agent (M-07)",
  'MG-34.add':
    "error: refused to add {name}: the source URL has credentials; keep credentials in git's credential helper or ssh-agent (M-07)",
  'MG-35.dash': 'error: refused to add {name}: a source cannot start with a dash (M-05)',
  'MG-35.scheme':
    'error: refused to add {name}: the source must be an https or ssh git address or an absolute folder (M-05)',
  'MG-35.name':
    'error: component name {name} is not valid: use lowercase letters, digits and hyphens, at most 64 (M-03)',
  'MG-36.name':
    'error: refused to store {name}: the name contains {word}; variables are public values that every agent reads (M-08)',
  'MG-36.value':
    'error: refused to store {name}: the value starts with {prefix}; variables are public values that every agent reads (M-08)',
  'MG-36.undeclared': 'error: {name} is not declared by any enabled component',
  'MG-36.closest': 'closest declared names: {names}',
  'MG-37': 'error: check failed: {check}',
  'MG-37.schema': 'schema: {component}: component.yaml is not a valid component/v1 manifest',
  'MG-37.exports': 'exports: {component}: exported path {path} does not exist',
  'MG-37.variables':
    'variables: {name}: {firstComponent} says "{firstDescription}", {secondComponent} says "{secondDescription}"',
  'MG-38': 'error: install failed: {what}',
  'MG-38.cause': '   cause: {cause}',
  'MG-39': '{severity}: {check}: {item}: {detail}',
  'MG-39.link-target-gone': 'the link target is gone',
  'MG-39.hash-differs': 'differs from install-state.json',
  'MG-39.lock-no-source': 'components.lock lists it but no list does',
  'MG-39.manifest-invalid': 'component.yaml is not a valid component/v1 manifest',
  'MG-39.manifest-missing': 'no component.yaml in {folder}',
  'MG-39.variable-missing': 'required by {component} and has no value',
  'MG-39.path-source-missing': 'path source folder {folder} does not exist',
  'MG-39.symlink-escape': 'leaves the component root',
  'MG-39.interrupted-install': 'restored to the previous state',
  'MG-39.not-version-controlled': '{path} is not in a git repository (not version-controlled)',
  'MG-39.compat-link': 'compatibility link still present',
  'MG-39.permissions': 'readable by others',
  'MG-39.old-agent-home-path': 'names ~/.copilot/knowledge',
  'MG-39.backups.one': 'warning: backups: 1 backup, {size}',
  'MG-39.backups.many': 'warning: backups: {count} backups, {size}',
} as const;

/** The id of one row of {@link MESSAGE_CATALOG}. */
export type MessageId = keyof typeof MESSAGE_CATALOG;
