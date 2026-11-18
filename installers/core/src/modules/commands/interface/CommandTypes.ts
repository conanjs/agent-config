// The public types of the commands module that the entry (src/CompositionRoot.ts, main.ts) and the other tiers use. Another module imports
// only `interface/**` (docs/architecture.md section 4) and a re-export is not allowed (TSN-18), so each type is named here as an alias.
import type {
  CommandOutput,
  CommandsDeps,
  HomeServices,
  InstallRequest,
  RenderingUse,
  UpdateRequest,
  VariablesUse,
} from '#commands/application/install/InstallTypes.ts';
import type * as Ports from '#commands/application/ports/CommandPorts.ts';

/** What the commands are given by the composition root. */
export type CommandServices = CommandsDeps;
/** The services that depend on the agent home. */
export type CommandHomeServices = HomeServices;
/** The variables use cases of one home. */
export type CommandVariables = VariablesUse;
/** The rendering use case of one home. */
export type CommandRendering = RenderingUse;
/** The result of a command: the report and the lines of text mode. */
export type CommandResult = CommandOutput;
/** What `install` and `plan` are asked to do. */
export type CommandRequest = InstallRequest;
/** Which git sources `install --update` advances. */
export type CommandUpdate = UpdateRequest;
/** The machine and the run. */
export type CommandEnvironment = Ports.Environment;
/** The terminal of the run. */
export type CommandTerminal = Ports.Terminal;
/** The versions of the programs. */
export type CommandRuntime = Ports.Runtime;
/** Reads folders and files for the install pipeline. */
export type CommandDiskReader = Ports.DiskReader;
/** One Markdown file of a component. */
export type CommandMarkdownFile = Ports.MarkdownFile;
