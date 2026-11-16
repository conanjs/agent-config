// DR-414, VR-5: the values of the old global-variables.md of the Copilot home folder are offered as proposals, never stored. A row of that file is
// "| `{{NAME}}` | <value> | <notes> |"; a value of `<SETUP REQUIRED>` means "not set". The text is V's own old file, so it is read
// with the same value rules as anything else: a row that fails them is dropped without a word, because a proposal is printed.
import { parseVariableName, type VariableName } from '#variables/domain/name/VariableName.ts';
import { secretNameWord } from '#variables/domain/secrets/SecretRules.ts';
import { parseVariableValue, type VariableValue } from '#variables/domain/value/VariableValue.ts';

/** The most lines read from the old file; the real file has about ten. */
export const MAX_LEGACY_LINES = 2000;

const NAME_CELL = /^`\{\{([A-Z][A-Z0-9_]*)\}\}`$/;
const NOT_SET = '<SETUP REQUIRED>';
const UNESCAPED_PIPE = /(?<!\\)\|/;

function unwrapBackticks(cell: string): string {
  return cell.length >= 2 && cell.startsWith('`') && cell.endsWith('`') ? cell.slice(1, -1).trim() : cell;
}

// One table row: its name and value when both are usable, else nothing.
function parseRow(line: string): readonly [VariableName, VariableValue] | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return undefined;
  const [, nameCell = '', valueCell = ''] = trimmed.split(UNESCAPED_PIPE);
  const matched = NAME_CELL.exec(nameCell.trim());
  const rawValue = unwrapBackticks(valueCell.trim());
  if (matched?.[1] === undefined || rawValue === NOT_SET) return undefined;
  const name = parseVariableName(matched[1]);
  const value = parseVariableValue(rawValue);
  return name.ok && value.ok && secretNameWord(name.value) === undefined ? [name.value, value.value] : undefined;
}

/**
 * Finds the variable values in the text of the old variables file.
 *
 * @param text - the whole old `global-variables.md`
 * @returns each declared-looking name with its first usable value (not `<SETUP REQUIRED>`, not empty, not secret-like, one safe line)
 */
export function legacyValueProposals(text: string): ReadonlyMap<VariableName, VariableValue> {
  const found = new Map<VariableName, VariableValue>();
  for (const line of text.split('\n', MAX_LEGACY_LINES)) {
    const row = parseRow(line);
    if (row !== undefined && !found.has(row[0])) found.set(row[0], row[1]);
  }
  return found;
}
