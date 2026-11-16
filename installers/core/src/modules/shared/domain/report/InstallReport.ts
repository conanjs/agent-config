// The one report model of the installer (DR-305, installer-cli.md "--json report"): every command builds one InstallReport,
// and the text presenter and the JSON presenter both read it. Plain immutable data; the rules that fill it are in ReportRules.ts.
import type { ExitCode } from '#shared/domain/exit/ExitCode.ts';

/** The commands whose result is a report (`rerender` prints nothing and is not one of them). */
export type CommandName = 'install' | 'plan' | 'doctor' | 'set' | 'add' | 'use' | 'init-component' | 'uninstall';

/** How a run ended; each value maps to exactly one exit code (see `exitCodeForStatus`). */
export type ReportStatus = 'done' | 'no-changes' | 'needs-input' | 'failed' | 'usage-error';

/** Where the agent home path came from. */
export type HomeSource = 'default' | 'AGENT_CONFIG_HOME' | 'recorded';

/** The agent home as the run saw it. */
export interface ReportHome {
  /** The absolute path of the agent home. */
  readonly path: string;
  /** Whether V confirmed this home. */
  readonly confirmed: boolean;
  /** Where the path came from. */
  readonly source: HomeSource;
  /** The recorded home, present only when the run is a move away from it. */
  readonly recorded?: string;
}

/** What a need asks V for; the report lists them in this order. */
export type NeedKind = 'home' | 'components' | 'variables' | 'privileged';

/** One thing the run needs from V before it can change anything (exit 10). */
export interface ReportNeed {
  /** Which family of need this is. */
  readonly kind: NeedKind;
  /** The thing needed: a home path, a slot, a variable name or a privileged entry. */
  readonly item: string;
  /** One sentence that says why. */
  readonly detail: string;
  /** The command or answer that satisfies the need. */
  readonly satisfy: string;
  /** A value V may accept, such as a `detect` result; never a command to run. */
  readonly proposal?: string;
  /** A source a component suggests; always unverified and never part of a ready command (M-11). */
  readonly suggested?: { readonly by: string; readonly verified: false; readonly source: string };
  /** The component that declares the item, for a privileged need. */
  readonly component?: string;
  /** The commit (or `live`) the privileged entry comes from. */
  readonly commit?: string;
  /** Set when no interactive terminal is attached and one is required (M-11). */
  readonly terminal?: 'needed';
}

/** The operation kinds of the plan (DR-306). */
export type ChangeOperation = 'backup' | 'link' | 'write' | 'chmod' | 'remove' | 'merge-entry';

/** The delivery class of a placed file (FR-015). */
export type DeliveryClass = 'linked' | 'rendered' | 'generated' | 'compat';

/** One planned or applied change. */
export interface ReportChange {
  /** The operation. */
  readonly op: ChangeOperation;
  /** The path the operation touches. */
  readonly path: string;
  /** The link target, for a link. */
  readonly target?: string;
  /** The content hash, for a write. */
  readonly hash?: string;
  /** The delivery class. */
  readonly class: DeliveryClass;
  /** The owning component. */
  readonly component: string;
  /** True when the change belongs to the privileged set (M-01). */
  readonly privileged: boolean;
}

/** One `doctor` or run finding. */
export interface ReportFinding {
  /** An error makes the run exit 1; a warning does not. */
  readonly severity: 'error' | 'warning';
  /** The check that found it, such as `link-target-gone`. */
  readonly check: string;
  /** What the finding is about, such as a path or a component. */
  readonly item: string;
  /** What is wrong. */
  readonly detail: string;
  /** What V can do about it. */
  readonly fix: string;
}

/** The report of one run, the document `--json` prints. */
export interface InstallReport {
  /** The report format and its major version. */
  readonly schema: 'install-report/v1';
  /** The command that ran. */
  readonly command: CommandName;
  /** How the run ended. */
  readonly status: ReportStatus;
  /** The exit code that goes with the status. */
  readonly exit: ExitCode;
  /** The agent home, or null for a command that needs none (`init-component`). */
  readonly home: ReportHome | null;
  /** What V must supply, ordered home, components, variables, privileged. */
  readonly needs: readonly ReportNeed[];
  /** The plan operations of the run. */
  readonly changes: readonly ReportChange[];
  /** Faults and warnings. */
  readonly findings: readonly ReportFinding[];
  /** The backup folder of this run, or null when none was made. */
  readonly backup: string | null;
}
