// VR-1: the one table of `generated/global-variables.md`. Pure: it builds the rows and the text from what the caller read, and holds
// no clock, no file and no placeholder expansion. Every value is put into the table in ONE pass and never expanded (M-08, T-07): a
// value such as `{{include:secret.md}}` or `{{OTHER}}` is text here, not a template.
import { escapeUnsafeText } from '#shared/domain/redaction/escapeUnsafeText.ts';
import { needsRedaction } from '#shared/domain/redaction/redact.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** The header line of the table; the scenarios and `doctor` find the table by it (VR-1). */
export const VARIABLE_TABLE_HEADER = '| Variable | Value | Description | Declared by |';

/** The line under the header that makes the lines below it a table. */
export const VARIABLE_TABLE_SEPARATOR = '| --- | --- | --- | --- |';

/** What the value cell says for an optional variable V has not set. */
export const NOT_SET_TEXT = '(not set)';

/** One row of the table, every cell still unescaped. */
export interface VariableRow {
  /** The variable name. */
  readonly name: string;
  /** The value as V stored it, or {@link NOT_SET_TEXT}. */
  readonly value: string;
  /** What the variable is for. */
  readonly description: string;
  /** The component that declares it. */
  readonly declaredBy: string;
}

/** The variable the installer computes; it is not declared by a component. */
export interface ComputedVariable {
  /** The name (`AGENT_HOME`). */
  readonly name: string;
  /** One line saying what it is. */
  readonly description: string;
  /** Who is shown as its declarer. */
  readonly declaredBy: string;
}

/** One variable of the union of the enabled components. */
export interface DeclaredVariableSource {
  /** The checked name. */
  readonly name: string;
  /** The description every declaring component agrees on. */
  readonly description: string;
  /** Every declaring component, in name order; the first is shown. */
  readonly declaredBy: readonly string[];
}

/** What the rows are built from. */
export interface VariableRowsInput {
  /** The agent home, the value of the computed variable. */
  readonly home: string;
  /** The computed variable that opens the table. */
  readonly computed: ComputedVariable;
  /** The variables of the enabled components, already merged and in table order (components by name, declaration order). */
  readonly declared: readonly DeclaredVariableSource[];
  /** V's stored values by name. */
  readonly values: ReadonlyMap<string, string>;
}

/** A cell that must not be printed: the sentence for it names the variable and the column, never the text. */
export interface RowViolation {
  /** The only kind: the text has credential-like content (M-07, M-08). */
  readonly kind: 'credential-like';
  /** The variable whose row holds it. */
  readonly name: string;
  /** Which cell. */
  readonly column: 'value' | 'description';
}

/**
 * Builds the rows of the table: the computed variable first, then one row per declared variable in the order given.
 *
 * A declared variable with no stored value gets {@link NOT_SET_TEXT}. A value stored for a name nobody declares (a component that is
 * no longer enabled) gets no row, so a disabled component leaves nothing in the file.
 *
 * @param input - the home, the computed variable, the merged declarations and V's values
 * @returns the rows, in the order they are printed
 */
export function buildVariableRows(input: VariableRowsInput): readonly VariableRow[] {
  const computed: VariableRow = {
    name: input.computed.name,
    value: input.home,
    description: input.computed.description,
    declaredBy: input.computed.declaredBy,
  };
  const declared = input.declared.map((variable): VariableRow => ({
    name: variable.name,
    value: input.values.get(variable.name) ?? NOT_SET_TEXT,
    description: variable.description,
    declaredBy: variable.declaredBy[0] ?? '',
  }));
  return [computed, ...declared];
}

/**
 * Makes a text safe for one cell of a pipe table: control, line-break, bidi and invisible characters become visible escapes, and each
 * `|` becomes `\|` (a backslash that already precedes a pipe is doubled first, so the pipe stays escaped).
 *
 * @param text - a name, value, description or component name as stored, possibly with pipes or line breaks
 * @returns one line that holds no unescaped pipe
 */
export function escapeTableCell(text: string): string {
  return escapeUnsafeText(text)
    .replace(/\\(?=\|)/g, '\\\\')
    .replaceAll('|', '\\|');
}

function rowLine(row: VariableRow): string {
  const cells = [row.name, row.value, row.description, row.declaredBy].map(escapeTableCell);
  return `| ${cells.join(' | ')} |`;
}

function violationsOf(row: VariableRow): readonly RowViolation[] {
  const found: RowViolation[] = [];
  if (needsRedaction(row.value)) found.push({ kind: 'credential-like', name: row.name, column: 'value' });
  if (needsRedaction(row.description)) found.push({ kind: 'credential-like', name: row.name, column: 'description' });
  return found;
}

/**
 * Prints the header, the separator and one line per row. A row with credential-like text is refused, not printed with the secret
 * hidden: the file is loaded by every agent, and a hidden secret is still a stored secret (the rule of `needsRedaction`).
 *
 * @param rows - the rows from {@link buildVariableRows}
 * @returns the table text with no final line ending, or every cell that must not be printed
 */
export function renderVariableTable(rows: readonly VariableRow[]): Result<string, readonly RowViolation[]> {
  const violations = rows.flatMap(violationsOf);
  if (violations.length > 0) return refuse(violations);
  return succeed([VARIABLE_TABLE_HEADER, VARIABLE_TABLE_SEPARATOR, ...rows.map(rowLine)].join('\n'));
}
