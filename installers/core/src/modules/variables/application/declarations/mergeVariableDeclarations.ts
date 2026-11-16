import type { Result } from '#shared/domain/result/Result.ts';
import {
  AGENT_HOME_ROW,
  mergeDeclarations,
  type ComponentVariables,
  type DeclarationViolation,
  type DeclaredVariable,
} from '#variables/domain/declaration/DeclaredVariables.ts';

/** The row of `AGENT_HOME` that opens the rendered table: computed by the installer, so no component declares it. */
export const AGENT_HOME_TABLE_ROW = AGENT_HOME_ROW;

/**
 * Merges the `variables:` lists of the enabled components into one list, one entry per name, in the order of the rendered table.
 *
 * Two components with one name and one description give one entry naming both; with two descriptions the install fails naming both
 * (VR-2). A secret-like name, a reserved name, a multi-line description and a detect rule that is not declarative are refused (M-08, M-18).
 *
 * @param components - the enabled components with their declarations, in any order
 * @returns the merged declarations, or every violation found
 */
export function mergeVariableDeclarations(
  components: readonly ComponentVariables[],
): Result<readonly DeclaredVariable[], readonly DeclarationViolation[]> {
  return mergeDeclarations(components);
}
