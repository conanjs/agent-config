// Step 1 of `set`, `install` and `plan` for variables: read V's values. Load, then parse, then check; the shell stays thin.
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { readValuesFile, type VariableValues } from '#variables/domain/file/ValuesFile.ts';
import type { VariablesFileStore } from '#variables/application/ports/VariablesFileStore.ts';
import type { YamlReader, YamlReaderFinding } from '#variables/application/ports/YamlReader.ts';

/** Why V's values cannot be used; `sentence` fills the `{sentence}` of MG-23 and never repeats a value. */
export interface ValuesLoadFailure {
  /** Which step refused the file. */
  readonly kind: 'unreadable' | 'invalid-yaml' | 'wrong-schema' | 'wrong-shape' | 'bad-entry';
  /** One sentence for MG-23, never holding a value. */
  readonly sentence: string;
}

/** The ports `loadValues` uses. */
export interface LoadValuesDependencies {
  /** Reads the file text. */
  readonly store: VariablesFileStore;
  /** Parses the text safely. */
  readonly readYaml: YamlReader;
}

function describeFinding(finding: YamlReaderFinding): string {
  return finding.line === undefined ? finding.message : `line ${finding.line}: ${finding.message}`;
}

/**
 * Reads `variables.local.yaml`: no file is "no values yet", and a file that is unreadable, not safe YAML, of another schema or
 * holding a secret-like name or value is refused as a whole, so nothing from it can reach the rendered table (M-08, M-17).
 *
 * @param dependencies - the file store and the YAML reader
 * @returns V's values by name, or why the file is refused
 */
export async function loadValues(
  dependencies: LoadValuesDependencies,
): Promise<Result<VariableValues, ValuesLoadFailure>> {
  // 1. Read the text (a missing file is not a failure).
  const read = await dependencies.store.readText();
  if (!read.ok) return refuse({ kind: 'unreadable', sentence: 'the file cannot be read as a regular file' });
  if (read.value === undefined) return succeed(new Map());
  // 2. Parse it with the hardened reader.
  const parsed = dependencies.readYaml(read.value);
  if (!parsed.ok) return refuse({ kind: 'invalid-yaml', sentence: parsed.findings.map(describeFinding).join('; ') });
  // 3. Check names and values.
  const values = readValuesFile(parsed.value);
  return values.ok ? values : refuse({ kind: values.error.kind, sentence: values.error.reason });
}
