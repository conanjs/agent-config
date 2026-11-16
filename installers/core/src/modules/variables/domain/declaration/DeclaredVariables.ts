// variables/v1 declarations of the enabled components, merged into one list: one entry per name (VR-1, VR-2). Pure: the manifests
// module reads the files, and this file only decides what the declarations mean together.
import type { ComponentName } from '#shared/domain/name/NameRules.ts';
import { parseDetectRule, type DetectRule } from '#variables/domain/declaration/DetectRule.ts';
import { parseVariableName, type VariableName } from '#variables/domain/name/VariableName.ts';
import { secretNameWord, type SecretNameWord } from '#variables/domain/secrets/SecretRules.ts';
import { escapeUnsafeText } from '#shared/domain/redaction/escapeUnsafeText.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** The row of `AGENT_HOME` in the rendered table: computed by the installer, so it is not a declaration. */
export const AGENT_HOME_ROW = {
  name: 'AGENT_HOME',
  description: 'Folder of the agent home',
  declaredBy: 'agent-config',
} as const;

/** One entry of a component's `variables:` list as the manifest reader hands it over (`detect` is checked here, not trusted). */
export interface VariableDeclarationInput {
  /** The variable name as written; checked by `mergeDeclarations`. */
  readonly name: string;
  /** One line saying what the variable is for. */
  readonly description: string;
  /** True when install needs a value (VR-6). */
  readonly required?: boolean | undefined;
  /** The `detect` entry as read; only the two declarative forms pass (M-18). */
  readonly detect?: unknown;
}

/** The `variables:` list of one enabled component. */
export interface ComponentVariables {
  /** The enabled component that declares them. */
  readonly component: ComponentName;
  /** Its declarations, in file order. */
  readonly variables: readonly VariableDeclarationInput[];
}

/** A variable of the union of the enabled components. */
export interface DeclaredVariable {
  /** The checked name. */
  readonly name: VariableName;
  /** The one description every declaring component agrees on. */
  readonly description: string;
  /** True when any declaring component marks it required (VR-6). */
  readonly required: boolean;
  /** The rule of the first declaring component (in component name order) that has one. */
  readonly detect: DetectRule | undefined;
  /** Every component that declares it, in name order; the first one is the "declared by" of the rendered row. */
  readonly declaredBy: readonly ComponentName[];
}

/** Why the declarations cannot be used; every violation names its component, and no sentence repeats a refused text. */
export type DeclarationViolation =
  | { readonly kind: 'invalid-name' | 'reserved-name'; readonly component: ComponentName; readonly reason: string }
  | {
      readonly kind: 'secret-like-name';
      readonly component: ComponentName;
      readonly name: VariableName;
      readonly word: SecretNameWord;
    }
  | {
      readonly kind: 'invalid-description' | 'invalid-detect';
      readonly component: ComponentName;
      readonly name: VariableName;
      readonly reason: string;
    }
  | {
      /** VR-2, MG-37.variables: the two descriptions are given in component name order. */
      readonly kind: 'description-conflict';
      readonly name: VariableName;
      readonly first: { readonly component: ComponentName; readonly description: string };
      readonly second: { readonly component: ComponentName; readonly description: string };
    };

/** The longest description accepted. */
export const MAX_DESCRIPTION_LENGTH = 300;

function descriptionProblem(description: string): string | undefined {
  if (description.trim() === '') return 'the description is empty';
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return `the description is longer than ${MAX_DESCRIPTION_LENGTH} characters`;
  }
  return escapeUnsafeText(description) === description && description.isWellFormed()
    ? undefined
    : 'the description must be one line with no control or invisible character';
}

interface CheckedDeclaration {
  readonly component: ComponentName;
  readonly name: VariableName;
  readonly description: string;
  readonly required: boolean;
  readonly detect: DetectRule | undefined;
}

// One declaration: the name first, then its secret-likeness, description and detect rule; the first problem of it is reported.
function checkDeclaration(
  component: ComponentName,
  input: VariableDeclarationInput,
): Result<CheckedDeclaration, DeclarationViolation> {
  const name = parseVariableName(input.name);
  if (!name.ok) return refuse({ kind: name.error.kind, component, reason: name.error.reason });
  const word = secretNameWord(name.value);
  if (word !== undefined) return refuse({ kind: 'secret-like-name', component, name: name.value, word });
  const problem = descriptionProblem(input.description);
  if (problem !== undefined) {
    return refuse({ kind: 'invalid-description', component, name: name.value, reason: problem });
  }
  const detect = parseDetectRule(input.detect, name.value);
  if (!detect.ok) return refuse({ kind: 'invalid-detect', component, name: name.value, reason: detect.error });
  return succeed({
    component,
    name: name.value,
    description: input.description,
    required: input.required === true,
    detect: detect.value,
  });
}

function byComponentName(left: ComponentVariables, right: ComponentVariables): number {
  if (left.component === right.component) return 0;
  return left.component < right.component ? -1 : 1;
}

// Merges the checked declarations of one name (already in component order): one description, any-required, first detect rule.
function mergeSameName(entries: readonly CheckedDeclaration[]): Result<DeclaredVariable, DeclarationViolation> {
  const [head, ...rest] = entries as [CheckedDeclaration, ...CheckedDeclaration[]];
  const differing = rest.find((entry) => entry.description !== head.description);
  if (differing !== undefined) {
    return refuse({
      kind: 'description-conflict',
      name: head.name,
      first: { component: head.component, description: head.description },
      second: { component: differing.component, description: differing.description },
    });
  }
  const declaredBy = entries
    .map((entry) => entry.component)
    .filter((component, index, all) => all.indexOf(component) === index);
  return succeed({
    name: head.name,
    description: head.description,
    required: entries.some((entry) => entry.required),
    detect: entries.find((entry) => entry.detect !== undefined)?.detect,
    declaredBy,
  });
}

/**
 * Merges the `variables:` lists of the enabled components into one list with one entry per name.
 *
 * Components are taken in name order and each in declaration order, so the list is the order of the rendered table (VR-1). Two
 * components that declare one name with the same description give one entry that names both; with different descriptions the
 * result is a `description-conflict` that names both in component name order (VR-2). Every problem is reported, not only the first,
 * so V fixes them in one go: violations come in component and declaration order, conflicts after them in order of first appearance.
 *
 * @param components - the enabled components with their declarations, in any order
 * @returns the merged declarations, or every violation found
 */
export function mergeDeclarations(
  components: readonly ComponentVariables[],
): Result<readonly DeclaredVariable[], readonly DeclarationViolation[]> {
  const violations: DeclarationViolation[] = [];
  const checked: CheckedDeclaration[] = [];
  for (const { component, variables } of [...components].sort(byComponentName)) {
    for (const input of variables) {
      const declaration = checkDeclaration(component, input);
      if (declaration.ok) checked.push(declaration.value);
      else violations.push(declaration.error);
    }
  }
  const byName = new Map<VariableName, CheckedDeclaration[]>();
  for (const declaration of checked) {
    const sameName = byName.get(declaration.name);
    if (sameName === undefined) byName.set(declaration.name, [declaration]);
    else sameName.push(declaration);
  }
  const merged: DeclaredVariable[] = [];
  for (const entries of byName.values()) {
    const outcome = mergeSameName(entries);
    if (outcome.ok) merged.push(outcome.value);
    else violations.push(outcome.error);
  }
  return violations.length === 0 ? succeed(merged) : refuse(violations);
}
