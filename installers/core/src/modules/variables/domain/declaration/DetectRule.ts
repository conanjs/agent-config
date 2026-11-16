// M-18, CM-7: a variable is found by looking, never by running a command, so a detect rule has exactly two forms. The manifest
// reader already refuses any other form; this file refuses it again, because a rule that reached the installer in another way (a
// future reader, a test double, a bug) must still be unable to name a command, and because the rule decides what the probe may touch.
import { parseRelativePath } from '#shared/domain/name/NameRules.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { secretNameWord } from '#variables/domain/secrets/SecretRules.ts';

/** Look at one environment variable; its value is a proposal only. */
export interface EnvDetectRule {
  /** Marks the environment-variable form. */
  readonly kind: 'env';
  /** The environment variable to read: the declared variable's own name (M-08). */
  readonly name: string;
}

/** Look for a folder below the user's home; the first one that exists is a proposal only. */
export interface DirExistsDetectRule {
  /** Marks the folder-probe form. */
  readonly kind: 'dir-exists';
  /** Each one as written in the manifest, `~/` followed by a path that passed the M-03 rules. */
  readonly candidates: readonly string[];
}

/** How a declaration says where its value might be found. There is no command form. */
export type DetectRule = EnvDetectRule | DirExistsDetectRule;

/** The most candidates one rule may list; a longer list is refused, not cut, so a rule never silently changes meaning. */
export const MAX_DETECT_CANDIDATES = 16;

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

const NO_COMMAND =
  'a detect rule is an environment variable name or a list of folders; a command is never allowed (M-18)';

function asRecord(raw: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Readonly<Record<string, unknown>>)
    : undefined;
}

// An environment variable holds credentials under many names, so the check is wider than the M-08 list: the proposal is printed on
// screen. Both checks apply: the name must be the variable's own AND must not look like a credential name (a variable `DB_PASS`
// cannot use an env rule at all). `pat` and `sig` match only as whole words between underscores, so KB_PATH and DESIGN_ROOT pass.
const CREDENTIAL_LIKE_ENV_NAME =
  /token|secret|pass|pwd|key|auth|cred|session|bearer|cookie|private|jwt|webhook|dsn|cert|(^|_)PATS?(_|$)|(^|_)SIG(NATURE)?(_|$)/i;

// M-08: an env rule may read only the variable's own name, which has passed the secret-name check. Any other name could point a
// harmless variable at a credential of V's session (CI_JOB_JWT, SLACK_WEBHOOK_URL, GH_PAT) and print it as a proposal.
function parseEnvRule(rule: Readonly<Record<string, unknown>>, variableName: string): Result<EnvDetectRule, string> {
  const name = rule['name'];
  if (typeof name !== 'string' || !ENV_NAME.test(name)) {
    return refuse('an env detect rule needs the name of one environment variable (letters, digits and underscore)');
  }
  if (name !== variableName || secretNameWord(name) !== undefined || CREDENTIAL_LIKE_ENV_NAME.test(name)) {
    return refuse(
      'an env detect rule may read only the environment variable that has the same name as the variable, and not one with a credential-like name (M-08)',
    );
  }
  return succeed({ kind: 'env', name });
}

function parseDirRule(rule: Readonly<Record<string, unknown>>): Result<DirExistsDetectRule, string> {
  const candidates = rule['candidates'];
  if (!Array.isArray(candidates) || candidates.length === 0 || candidates.length > MAX_DETECT_CANDIDATES) {
    return refuse(`a dir-exists detect rule lists 1 to ${MAX_DETECT_CANDIDATES} folders`);
  }
  const checked: string[] = [];
  for (const candidate of candidates as unknown[]) {
    if (typeof candidate !== 'string' || !candidate.startsWith('~/') || !parseRelativePath(candidate.slice(2)).ok) {
      return refuse('each folder of a dir-exists detect rule starts with ~/ and passes the path rules (M-03)');
    }
    checked.push(candidate);
  }
  return succeed({ kind: 'dir-exists', candidates: checked });
}

/**
 * Reads a detect rule from the plain data of a declaration, accepting only the two declarative forms.
 *
 * Only the known fields are copied, so an extra key on a valid rule, such as a `command`, never reaches the result.
 *
 * @param raw - the `detect` entry as the manifest reader hands it over, or `undefined` when the declaration has none
 * @param variableName - the name of the variable that declares the rule; an env rule may read only that one
 * @returns the rule, `undefined` for a declaration with no rule, or the sentence that says what is wrong (it never repeats the text)
 */
export function parseDetectRule(raw: unknown, variableName: string): Result<DetectRule | undefined, string> {
  if (raw === undefined || raw === null) return succeed(undefined);
  const rule = asRecord(raw);
  if (rule === undefined) return refuse(NO_COMMAND);
  if (rule['kind'] === 'env') return parseEnvRule(rule, variableName);
  if (rule['kind'] === 'dir-exists') return parseDirRule(rule);
  return refuse(NO_COMMAND);
}
