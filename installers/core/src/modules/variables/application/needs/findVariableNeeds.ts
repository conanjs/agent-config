// VR-6, AC-6.4, DR-414, M-18: which required variables have no value, and what the installer may propose for each. A proposal is text
// to show V next to `set NAME=<value>`; it is never stored and never rendered (A-10).
import type { ComponentName } from '#shared/domain/name/NameRules.ts';
import { joinUnderRoot, type PathFlavor } from '#shared/domain/path/PathContainment.ts';
import type { DetectProbe } from '#variables/application/ports/DetectProbe.ts';
import type { DeclaredVariable } from '#variables/domain/declaration/DeclaredVariables.ts';
import type { DetectRule } from '#variables/domain/declaration/DetectRule.ts';
import type { VariableValues } from '#variables/domain/file/ValuesFile.ts';
import { legacyValueProposals } from '#variables/domain/legacy/legacyValues.ts';
import type { VariableName } from '#variables/domain/name/VariableName.ts';
import { parseVariableValue } from '#variables/domain/value/VariableValue.ts';

/** One "variables" need of the needs report (MG-08). */
export interface VariableNeed {
  /** The variable that needs a value. */
  readonly name: VariableName;
  /** What it is for, as the declaring component wrote it. */
  readonly description: string;
  /** Every declaring component in name order; MG-08.detail prints them after "declared by". */
  readonly declaredBy: readonly ComponentName[];
  /** A detected value or a value of the old variables file; absent when there is none (no proposal line, AC-6.4). */
  readonly proposal: string | undefined;
}

/** What the search needs. */
export interface VariableNeedsRequest {
  /** The merged declarations of the enabled components. */
  readonly declared: readonly DeclaredVariable[];
  /** V's stored values. */
  readonly values: VariableValues;
  /** The ports detect proposals look through. */
  readonly probe: DetectProbe;
  /** The user's home folder, which `~/` candidates are placed under. */
  readonly userHome: string;
  /** The path syntax of the machine. */
  readonly flavor: PathFlavor;
  /** The text of the old global-variables.md of the Copilot home folder while it still exists, else `undefined` (DR-414). */
  readonly legacyText: string | undefined;
}

async function detectedProposal(
  variableName: string,
  rule: DetectRule,
  request: VariableNeedsRequest,
): Promise<string | undefined> {
  if (rule.kind === 'env') {
    // Defence in depth for M-08: the rule was checked at declaration, and a rule for another name is never read.
    if (rule.name !== variableName) return undefined;
    const found = request.probe.environmentValue(rule.name);
    // The value goes through the value rules: a credential in the environment is never shown (M-08).
    const value = found === undefined ? undefined : parseVariableValue(found);
    return value?.ok === true ? value.value : undefined;
  }
  for (const candidate of rule.candidates) {
    const absolute = joinUnderRoot(request.userHome, candidate.slice(2), request.flavor);
    if (absolute.ok && (await request.probe.directoryExists(absolute.value))) return candidate;
  }
  return undefined;
}

/**
 * Lists the required variables that have no value, in declaration order, each with the proposal the installer may show.
 *
 * A detect proposal wins over an old-file value. Variables that are not required, or already have a value, are not needs.
 *
 * @param request - the declarations, V's values and the ports to look with
 * @returns the needs; an empty list means every required variable has a value
 */
export async function findVariableNeeds(request: VariableNeedsRequest): Promise<VariableNeed[]> {
  const legacy = request.legacyText === undefined ? new Map() : legacyValueProposals(request.legacyText);
  const needs: VariableNeed[] = [];
  for (const variable of request.declared) {
    if (!variable.required || request.values.has(variable.name)) continue;
    const detected =
      variable.detect === undefined ? undefined : await detectedProposal(variable.name, variable.detect, request);
    needs.push({
      name: variable.name,
      description: variable.description,
      declaredBy: variable.declaredBy,
      proposal: detected ?? (legacy.get(variable.name) as string | undefined),
    });
  }
  return needs;
}
