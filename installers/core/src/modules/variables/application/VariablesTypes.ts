// The public types of the variables module. Other modules may import only `application/**` (docs/architecture.md §4) and a
// re-export is not allowed (TSN-18), so each domain type they need is named here as an alias of the declaring type.
import type { AgentHomeChoice, AgentHomeRequest, AgentHomeViolation } from '#variables/domain/home/AgentHome.ts';
import type {
  ComponentVariables,
  DeclarationViolation,
  DeclaredVariable,
  VariableDeclarationInput,
} from '#variables/domain/declaration/DeclaredVariables.ts';
import type { DetectRule } from '#variables/domain/declaration/DetectRule.ts';
import type { VariableValues } from '#variables/domain/file/ValuesFile.ts';
import type { VariableName } from '#variables/domain/name/VariableName.ts';
import type { VariableValue } from '#variables/domain/value/VariableValue.ts';

/** A checked variable name (upper snake case, not `AGENT_HOME`). */
export type PublicVariableName = VariableName;
/** A checked public value: one safe line with no credential-like text. */
export type PublicVariableValue = VariableValue;
/** V's stored values by name. */
export type PublicVariableValues = VariableValues;
/** One variable of the union of the enabled components, ready for the rendered table and the needs report. */
export type PublicDeclaredVariable = DeclaredVariable;
/** One entry of a component's `variables:` list as the manifest reader hands it over. */
export type PublicVariableDeclarationInput = VariableDeclarationInput;
/** The `variables:` list of one enabled component. */
export type PublicComponentVariables = ComponentVariables;
/** Why declarations cannot be used (VR-2, M-08, M-18). */
export type PublicDeclarationViolation = DeclarationViolation;
/** A declarative detect rule. */
export type PublicDetectRule = DetectRule;
/** The agent home of a run, with its source and whether V confirmed it. */
export type PublicAgentHomeChoice = AgentHomeChoice;
/** What the home choice needs from the machine. */
export type PublicAgentHomeRequest = AgentHomeRequest;
/** Why no agent home can be chosen. */
export type PublicAgentHomeViolation = AgentHomeViolation;
