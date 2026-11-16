// fault-adapters.ts — the fault adapter of the installer scenarios (specs/022 T118, DR-305, QA need TR-3).
//
// WHAT IT IS. A wrapper around three driven ports of the installer core (FileSystem, Links, Git) that can only make an
// operation FAIL: a faulted call throws (or rejects) without calling the real port; every other call goes to the real port
// and its result or error comes back unchanged. The wrapper never returns a value of its own, so it can never turn a
// failure into a success or invent one. (A kill fault ends the process; if the injected kill function returns, the call
// still throws.)
//
// THE FAULTS (written in AGENT_CONFIG_TEST_FAULT as a comma-separated list):
//   fail-write:<n>            the n-th write call (1-based) of the FileSystem port throws EIO, once. For T118's own scenarios;
//                             installer scenarios should prefer fail-write-at, which does not depend on how many writes a run makes.
//   fail-write-at:<suffix>    every FileSystem write that has a string argument ending with <suffix> throws EIO, for example
//                             install-state.json (the final file of a run; install-state.pending.json does not match)
//   links-denied              every link creation (createLink, switchLink) throws EPERM, for any link kind
//   links-denied:symlink      the same, only for kind 'symlink' (third argument); links-denied:junction likewise
//   fetch-fails:<component>   every clone or fetch of the Git port for that component rejects. The request object's `component`
//                             field decides when there is one; else a path or URL argument whose last segment (without .git
//                             and @id) is the component
//   kill-at:before-first-switch   the process dies as the first link switch starts
//   kill-at:after-switch:<k>      the process dies right after the k-th link switch completed (k may equal the number of
//                                 switches of the run: the kill then falls between the last switch and what follows)
//   kill-at:mid-switch:<k>        the process dies between removeLink and createLink of the k-th switch (Windows composed
//                                 switch; never fires for an atomic switchLink)
//   kill-at:before-commit         the process dies as the next FileSystem write that has an argument ending with
//                                 install-state.json starts (the commit of a run, DR-202)
//   kill-after-switch:<k>         alias of kill-at:after-switch:<k>
// A SWITCH is one switchLink call (POSIX: temp link plus rename inside the adapter), or a removeLink that is followed by a
// createLink (Windows, composed in the application layer; the removeLink starts it and the createLink completes it). A
// createLink with no removeLink before it is a plain creation, not a switch.
// The default kill is SIGKILL on POSIX (the scenario runner maps it to exit code 137) and process.exit(137) on Windows: either
// way no `finally` or rollback code of the installer runs.
//
// HOW A SCENARIO SELECTS THE TEST COMPOSITION AND INJECTS A FAULT.
//   1. A scenario step records the fault in the World ("the installer fails write number 2", "the installer cannot create
//      links", "the installer cannot create symlinks", "fetching the component {string} fails", "the installer fails the
//      write of {string}", "the installer process is killed after link switch {int}", "the installer process is killed at
//      {string}"; "the installer runs without faults from now on" clears them).
//   2. The installer runner of tests/support/installer-world.ts (`installerRunner`) starts
//      `node tests/support/installer-test-main.ts <args>` and puts the faults in the environment variable
//      AGENT_CONFIG_TEST_FAULT, with the other test settings (clock, terminal, node and git version commands; see
//      installer-test-settings.ts). The production entry `installers/core/main.ts` is never started by a scenario that
//      injects anything.
//   3. installer-test-main.ts (the TEST ENTRY, a [QA] file written with the CompositionRoot task; it lives under tests/, which
//      may depend on installers/) builds the real adapters with `realPorts({ gitProtocols: ['https','ssh','file'] })`, wraps
//      FileSystem, Links and Git with `createFaultInjector(faultsFromEnvironment()).wrap(role, port)` and hands the wrapped
//      ports to the installer. It is the only reader of AGENT_CONFIG_TEST_FAULT (through readTestSettings).
//
// WHY THE PRODUCTION BUILD CAN NEVER LOAD IT (guard in three parts).
//   a. Nothing under installers/ or contracts/ imports this file, installer-world.ts, installer-test-settings.ts or any
//      path under tests/, and nothing there names AGENT_CONFIG_TEST_ or loads code from a computed path: the production
//      entry graph has no edge to it. The dependency also points the allowed way (checks may depend on the composition
//      root, never the reverse; docs/architecture.md section 4).
//   b. The check is `findSeamLeaks` in seam-guard.ts (rules listed in its header). It runs in `pnpm test:unit` over the real
//      repository (tests/installer-world/seam-guard.test.ts), so `scripts/check-new-tiers.sh` and CI fail on a leak, and the
//      scenarios T118-11 to T118-16 plus the unit tests prove each rule (mutation proof, QB-7). It is a text scan: the
//      dynamic proof, pending scenario T118-10 (the production entry with every test variable set behaves as without them),
//      is the authority.
//   c. The production entry reads no AGENT_CONFIG_TEST_* variable.
//
// CONTRACT FOR THE TASKS THAT BUILD THE INSTALLER (T129 to T142). The port types below are local copies of what the ports are
// expected to look like; installers/ does not exist yet. When it does, tests may import the real types from it and
// `PortSpec<T>` then fails to compile if a method is renamed (`keyof T`). Until then the strict runtime check in `wrap` throws
// when a port has a method the spec does not classify, or the spec names a method the port lacks.
//   Ports. FileSystem and Links are synchronous; Git and Terminal are asynchronous (Terminal.ask returns Promise<string>;
//     Terminal.interactive is a plain property). Links: createLink(path, target, kind: 'symlink' | 'junction'), removeLink(path),
//     switchLink(path, target, kind) (POSIX: temp link plus rename; Windows: the application composes removeLink then
//     createLink instead). Git: clone(request) and fetch(request) with request = { component, url, dest }; versions belong
//     to the Runtime port, so the Git port has no `version`.
//   Git policy (M-05, security F2). M-05 sets GIT_ALLOW_PROTOCOL=https:ssh, which refuses the local bare repositories of the
//     world ("transport 'file' not allowed", verified with git 2.50.1). So the policy is data: GitPolicy = { allowedProtocols:
//     readonly ('https' | 'ssh' | 'file')[] }. Production realPorts() hard-codes ['https', 'ssh']; the test entry calls
//     realPorts({ gitProtocols: ['https', 'ssh', 'file'] }); source validation (T133) takes the same policy, so a local path as
//     a git source is refused with exit 1 by the production entry (pending scenario T118-17) and accepted in the test entry.
//   For T138 and T142. An empty AGENT_CONFIG_HOME means unset. Check terminal.interactive before ask (M-11). main.ts sets
//     process.exitCode and never calls process.exit (reserved for the kill fault); one shared runCli(argv, ports, io) is used
//     by main.ts and by the test entry. The test entry imports the installer through a root `imports` alias (for example
//     #installer/*) that T129 adds to package.json. Nothing under installers/ registers process.on('exit') or
//     process.on('beforeExit') (T129's lint config enforces it), because a kill must leave no clean-up behind.

/** Environment variable that carries the faults, read only by the test entry. */
export const FAULT_ENV = 'AGENT_CONFIG_TEST_FAULT';

export type LinkKind = 'symlink' | 'junction';
export type KillPoint = 'before-first-switch' | 'after-switch' | 'mid-switch' | 'before-commit';

/** One injectable failure. */
export type Fault =
  | { kind: 'fail-nth-write'; n: number }
  | { kind: 'fail-write-at'; suffix: string }
  | { kind: 'links-not-permitted'; linkKind?: LinkKind }
  | { kind: 'fetch-fails'; component: string }
  | { kind: 'kill'; point: KillPoint; n?: number };

const componentId = /^[a-z0-9][a-z0-9-]{0,63}$/;
const knownFaults =
  'fail-write:<n>, fail-write-at:<suffix>, links-denied[:symlink|:junction], fetch-fails:<component>, ' +
  'kill-at:<before-first-switch|after-switch:<k>|mid-switch:<k>|before-commit>, kill-after-switch:<k>';

function positiveWhole(text: string, item: string): number {
  if (!/^[1-9]\d{0,5}$/.test(text)) throw new Error(`fault "${item}": "${text}" is not a positive whole number`);
  return Number(text);
}

function parseKill(item: string, point: string, n: string | undefined): Fault {
  switch (point) {
    case 'before-first-switch':
    case 'before-commit':
      if (n !== undefined) throw new Error(`fault "${item}" takes no number`);
      return { kind: 'kill', point };
    case 'after-switch':
    case 'mid-switch':
      return { kind: 'kill', point, n: positiveWhole(n ?? '', item) };
    default:
      throw new Error(`unknown kill point in "${item}" (known: ${knownFaults})`);
  }
}

function parseLinksDenied(item: string, kind: string | undefined): Fault {
  if (kind === undefined) return { kind: 'links-not-permitted' };
  if (kind !== 'symlink' && kind !== 'junction')
    throw new Error(`fault "${item}": "${kind}" is not symlink or junction`);
  return { kind: 'links-not-permitted', linkKind: kind };
}

type Parts = { item: string; first: string | undefined; second: string | undefined };

function oneValue({ item, first, second }: Parts, what: string): string {
  if (!first || second !== undefined) throw new Error(`fault "${item}" needs ${what}`);
  return first;
}

const parsers: Readonly<Record<string, (parts: Parts) => Fault>> = {
  'fail-write': (p) => ({ kind: 'fail-nth-write', n: positiveWhole(oneValue(p, 'one number'), p.item) }),
  'fail-write-at': (p) => ({ kind: 'fail-write-at', suffix: oneValue(p, 'one path suffix') }),
  'links-denied': (p) => {
    if (p.second !== undefined) throw new Error(`fault "${p.item}" takes at most one kind`);
    return parseLinksDenied(p.item, p.first);
  },
  'fetch-fails': (p) => {
    const component = oneValue(p, 'a component id');
    if (!componentId.test(component)) throw new Error(`fault "${p.item}": "${component}" is not a component id`);
    return { kind: 'fetch-fails', component };
  },
  'kill-at': (p) => parseKill(p.item, p.first ?? '', p.second),
  'kill-after-switch': (p) => ({
    kind: 'kill',
    point: 'after-switch',
    n: positiveWhole(oneValue(p, 'one number'), p.item),
  }),
};

function parseFault(item: string): Fault {
  const [name = '', first, second, ...rest] = item.split(':');
  if (rest.length > 0) throw new Error(`fault "${item}" has too many ":" parts`);
  const parse = Object.hasOwn(parsers, name) ? parsers[name] : undefined;
  if (!parse) throw new Error(`unknown fault "${item}" (known: ${knownFaults})`);
  return parse({ item, first, second });
}

/** Parses the text of AGENT_CONFIG_TEST_FAULT; empty text is no fault; an unknown or malformed fault throws. */
export function parseFaults(text: string): Fault[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
    .map(parseFault);
}

function formatFault(fault: Fault): string {
  switch (fault.kind) {
    case 'fail-nth-write':
      return `fail-write:${fault.n}`;
    case 'fail-write-at':
      return `fail-write-at:${fault.suffix}`;
    case 'links-not-permitted':
      return fault.linkKind ? `links-denied:${fault.linkKind}` : 'links-denied';
    case 'fetch-fails':
      return `fetch-fails:${fault.component}`;
    case 'kill':
      return `kill-at:${fault.point}${fault.n === undefined ? '' : `:${fault.n}`}`;
  }
}

/** The text form of a fault list, the inverse of parseFaults (the alias kill-after-switch is written as kill-at:after-switch). */
export function formatFaults(faults: readonly Fault[]): string {
  return faults.map(formatFault).join(',');
}

/** The faults named by an environment (FAULT_ENV); absent or empty is none. */
export function faultsFromEnvironment(env: Readonly<Record<string, string | undefined>> = process.env): Fault[] {
  return parseFaults(env[FAULT_ENV] ?? '');
}

/** The error every injected failure throws, so a scenario or test can tell it from a real one. */
export class InjectedFault extends Error {
  readonly injected = true;
  readonly code: string;
  readonly fault: Fault['kind'];

  constructor(fault: Fault['kind'], code: string, message: string) {
    super(message);
    this.name = 'InjectedFault';
    this.code = code;
    this.fault = fault;
  }
}

// ---- Local copies of the port types (see the contract in the header) -----------------------------------

export interface FileSystemPort {
  writeFile(path: string, text: string): void;
  appendFile(path: string, text: string): void;
  makeDirectory(path: string): void;
  rename(from: string, to: string): void;
  remove(path: string): void;
  copyTree(from: string, to: string): void;
  setMode(path: string, mode: number): void;
  readFile(path: string): string;
  readDirectory(path: string): string[];
  stat(path: string): unknown;
  exists(path: string): boolean;
  realPath(path: string): string;
}

export interface LinksPort {
  createLink(path: string, target: string, kind: LinkKind): void;
  removeLink(path: string): void;
  switchLink(path: string, target: string, kind: LinkKind): void;
  readLink(path: string): string;
}

/** What a git operation is about: the component, where it comes from and where it goes. */
export interface GitRequest {
  component: string;
  url: string;
  dest: string;
}

export interface GitPort {
  clone(request: GitRequest): Promise<void>;
  fetch(request: GitRequest): Promise<void>;
  revParse(folder: string): Promise<string>;
  checkout(request: GitRequest & { ref: string }): Promise<void>;
}

/** The three ports a fault can touch, and their types. */
export interface PortTypes {
  fileSystem: FileSystemPort;
  links: LinksPort;
  git: GitPort;
}
export type PortRole = keyof PortTypes;

/**
 * Which methods of one port belong to which class of operation. `classes` names the classes a fault looks at
 * (fileSystem: write; links: create, remove, switch; git: fetch); a method may be in several classes. `unfaulted` lists every
 * other method. `async` is true for a port whose methods return promises (Git) and false for a synchronous one (FileSystem,
 * Links): a port is never mixed, and a faulted async method rejects instead of throwing.
 */
export interface PortSpec<T> {
  readonly unfaulted: readonly (keyof T & string)[];
  readonly classes: Readonly<Record<string, readonly (keyof T & string)[]>>;
  readonly async?: boolean;
}

/** The method names the ports are expected to have (see the header). */
export const defaultPortSpecs: { [R in PortRole]: PortSpec<PortTypes[R]> } = {
  fileSystem: {
    classes: { write: ['writeFile', 'appendFile', 'makeDirectory', 'rename', 'remove', 'copyTree', 'setMode'] },
    unfaulted: ['readFile', 'readDirectory', 'stat', 'exists', 'realPath'],
  },
  links: {
    classes: { create: ['createLink', 'switchLink'], remove: ['removeLink'], switch: ['switchLink'] },
    unfaulted: ['readLink'],
  },
  git: {
    async: true,
    classes: { fetch: ['clone', 'fetch'] },
    unfaulted: ['revParse', 'checkout'],
  },
};

/** What an injector did, for unit tests and for a test entry that wants to log it. */
export interface FaultReport {
  /** Write calls seen on the FileSystem port. */
  writes: number;
  /** Link switches completed on the Links port. */
  linkSwitches: number;
  /** One line per failure injected, in order. */
  injected: string[];
}

export interface FaultOptions {
  /** Ends the process for a kill fault. Default: killLikeSigkill. If it returns, the call still fails. */
  kill?: () => void;
}

export interface FaultInjector {
  /** Returns a port that behaves as `port`, except where a fault says an operation fails. */
  wrap<R extends PortRole>(role: R, port: PortTypes[R]): PortTypes[R];
  wrap<T extends object>(role: PortRole, port: T, spec: PortSpec<T>): T;
  report(): FaultReport;
}

/** Ends the process the way SIGKILL would: SIGKILL to itself on POSIX (the runner maps it to 137), exit 137 on Windows. */
export function killLikeSigkill(): never {
  if (process.platform !== 'win32') process.kill(process.pid, 'SIGKILL');
  return process.exit(137);
}

type Method = (...args: unknown[]) => unknown;
type LooseSpec = Pick<PortSpec<Record<string, unknown>>, 'async'> & {
  readonly unfaulted: readonly string[];
  readonly classes: Readonly<Record<string, readonly string[]>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The part of a path, URL or store folder name that is the component: `x/y/core.git`, `store/core@1a2b` and `core` give `core`. */
function stemOf(text: string): string {
  const last = text.split(/[\\/]/).filter(Boolean).pop() ?? '';
  return last.replace(/\.git$/, '').replace(/@.*$/, '');
}

/**
 * Whether a Git call is about the component. A request object with a `component` field (or `name`) decides alone; without
 * one, some string argument is a path, URL or folder name whose last segment (without `.git` and `@<id>`) is the component.
 * The match is exact, never a substring.
 */
export function namesComponent(args: readonly unknown[], component: string): boolean {
  const declared = args
    .filter(isRecord)
    .flatMap((arg) => [arg['component'], arg['name']].filter((v) => typeof v === 'string'));
  if (declared.length > 0) return declared.includes(component);
  return args.some((arg) => typeof arg === 'string' && stemOf(arg) === component);
}

function methodNames(port: object): string[] {
  const names = new Set<string>();
  for (
    let level: object | null = port;
    level && level !== Object.prototype;
    level = Object.getPrototypeOf(level) as object | null
  ) {
    for (const key of Object.getOwnPropertyNames(level)) {
      const descriptor = Object.getOwnPropertyDescriptor(level, key);
      if (key !== 'constructor' && typeof descriptor?.value === 'function') names.add(key);
    }
  }
  return [...names].sort();
}

function checkSpec(role: PortRole, names: readonly string[], spec: LooseSpec): void {
  const listed = new Set([...spec.unfaulted, ...Object.values(spec.classes).flat()]);
  const unclassified = names.filter((name) => !listed.has(name));
  const missing = [...listed].filter((name) => !names.includes(name));
  if (unclassified.length > 0 || missing.length > 0) {
    throw new Error(
      `${role}: the fault spec and the port disagree; port methods the spec does not classify: [${unclassified.join(', ')}]; ` +
        `spec methods the port does not have: [${missing.join(', ')}]`,
    );
  }
}

interface State {
  writes: number;
  /** Switches started, completed, and the number of the switch whose removeLink ran but whose createLink has not (0: none). */
  started: number;
  completed: number;
  mid: number;
  injected: string[];
}

/** What a decision says about one call: fail it before it runs, and/or check something after it returned. */
interface Verdict {
  error?: InjectedFault;
  after?: () => InjectedFault | undefined;
}
type Decision = (classes: readonly string[], args: readonly unknown[]) => Verdict | undefined;
type KillFault = Extract<Fault, { kind: 'kill' }>;

function killFault(faults: readonly Fault[], point: KillPoint, n?: number): KillFault | undefined {
  return faults.find((f): f is KillFault => f.kind === 'kill' && f.point === point && (n === undefined || f.n === n));
}

function stringArgEndsWith(args: readonly unknown[], suffix: string): boolean {
  return args.some((arg) => typeof arg === 'string' && arg.endsWith(suffix));
}

function fileSystemDecision(faults: readonly Fault[], state: State, kill: () => void): Decision {
  return (classes, args) => {
    if (!classes.includes('write')) return undefined;
    state.writes += 1;
    if (killFault(faults, 'before-commit') && stringArgEndsWith(args, 'install-state.json')) {
      kill();
      return {
        error: new InjectedFault(
          'kill',
          'KILLED',
          'process killed before the commit of install-state.json (injected fault)',
        ),
      };
    }
    const at = faults.find((f) => f.kind === 'fail-write-at' && stringArgEndsWith(args, f.suffix));
    const nth = faults.find((f) => f.kind === 'fail-nth-write' && f.n === state.writes);
    const hit = at ?? nth;
    return (
      hit && { error: new InjectedFault(hit.kind, 'EIO', `EIO: i/o error, write ${state.writes} (injected fault)`) }
    );
  };
}

function linksDenied(
  faults: readonly Fault[],
  classes: readonly string[],
  args: readonly unknown[],
): InjectedFault | undefined {
  if (!classes.includes('create')) return undefined;
  const hit = faults.find(
    (f) => f.kind === 'links-not-permitted' && (f.linkKind === undefined || f.linkKind === args[2]),
  );
  return hit && new InjectedFault(hit.kind, 'EPERM', 'EPERM: operation not permitted, symlink (injected fault)');
}

function killAt(
  faults: readonly Fault[],
  state: State,
  kill: () => void,
  point: KillPoint,
  n?: number,
): InjectedFault | undefined {
  if (!killFault(faults, point, n)) return undefined;
  kill();
  return new InjectedFault(
    'kill',
    'KILLED',
    `process killed at ${point}${n === undefined ? '' : ` ${n}`} (injected fault)`,
  );
}

function linksDecision(faults: readonly Fault[], state: State, kill: () => void): Decision {
  const complete = (): InjectedFault | undefined => {
    state.completed += 1;
    state.mid = 0;
    return killAt(faults, state, kill, 'after-switch', state.completed);
  };
  /** A switch starts (atomic switchLink, or the removeLink of a composed one): count it and apply before-first-switch. */
  const start = (composed: boolean): Verdict | undefined => {
    state.started += 1;
    if (composed) state.mid = state.started;
    const first = state.started === 1 ? killAt(faults, state, kill, 'before-first-switch') : undefined;
    if (first) return { error: first };
    return composed ? undefined : { after: complete };
  };
  /** A createLink after a removeLink: apply mid-switch, else it completes the switch. */
  const finish = (): Verdict => {
    const mid = killAt(faults, state, kill, 'mid-switch', state.mid);
    return mid ? { error: mid } : { after: complete };
  };
  return (classes, args) => {
    const denied = linksDenied(faults, classes, args);
    if (denied) return { error: denied };
    if (classes.includes('switch')) return start(false);
    if (classes.includes('remove') && state.mid === 0) return start(true);
    return classes.includes('create') && state.mid !== 0 ? finish() : undefined;
  };
}

function gitDecision(faults: readonly Fault[]): Decision {
  return (classes, args) => {
    if (!classes.includes('fetch')) return undefined;
    const hit = faults.find((f) => f.kind === 'fetch-fails' && namesComponent(args, f.component));
    return (
      hit && { error: new InjectedFault(hit.kind, 'FETCH_FAILED', 'fetch failed for the component (injected fault)') }
    );
  };
}

function guarded(
  original: Method,
  port: object,
  classes: readonly string[],
  decide: Decision,
  spec: LooseSpec,
  state: State,
): Method {
  return (...args) => {
    const verdict = decide(classes, args);
    if (verdict?.error) {
      state.injected.push(`${verdict.error.fault}: ${verdict.error.message}`);
      if (spec.async === true) return Promise.reject(verdict.error);
      throw verdict.error;
    }
    const result: unknown = Reflect.apply(original, port, args);
    const late = verdict?.after?.();
    if (late) {
      state.injected.push(`${late.fault}: ${late.message}`);
      throw late;
    }
    return result;
  };
}

/**
 * Builds the injector of one test composition. A fault the run never reaches (write 9 of a run with 3 writes) does
 * nothing and the scenario sees a normal run.
 */
export function createFaultInjector(faults: readonly Fault[], options: FaultOptions = {}): FaultInjector {
  const state: State = { writes: 0, started: 0, completed: 0, mid: 0, injected: [] };
  const kill = options.kill ?? killLikeSigkill;
  const decisions: Record<PortRole, Decision> = {
    fileSystem: fileSystemDecision(faults, state, kill),
    links: linksDecision(faults, state, kill),
    git: gitDecision(faults),
  };
  function wrap(role: PortRole, port: object, spec?: LooseSpec): object {
    const chosen: LooseSpec = spec ?? defaultPortSpecs[role];
    const names = methodNames(port);
    checkSpec(role, names, chosen);
    const table = new Map<string, Method>();
    for (const name of names) {
      const original = (port as Record<string, Method>)[name];
      if (!original) continue;
      const classes = Object.entries(chosen.classes)
        .filter(([, methods]) => methods.includes(name))
        .map(([className]) => className);
      table.set(name, guarded(original, port, classes, decisions[role], chosen, state));
    }
    return new Proxy(port, {
      get: (target, key) =>
        typeof key === 'string' && table.has(key) ? table.get(key) : (Reflect.get(target, key, target) as unknown),
    });
  }
  return {
    wrap,
    report: () => ({ writes: state.writes, linkSwitches: state.completed, injected: [...state.injected] }),
  };
}
