// The public types of the rendering module. Other modules import only `application/**` (docs/architecture.md section 4) and re-exports
// are not allowed (TSN-18), so each domain type they need is named here as an alias of the declaring type.
import type { RowViolation, VariableRow } from '#rendering/domain/variables/VariableTable.ts';

/** One row of `global-variables.md`. */
export type RenderedVariableRow = VariableRow;
/** A cell of `global-variables.md` that is not printed because it has credential-like text. */
export type RenderedRowViolation = RowViolation;
