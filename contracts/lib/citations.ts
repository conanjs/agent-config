// The slot, location and citation classifier (specs/022 T056, FR-023, AC-5.10, A-24; slots-v1.md rules SL-4). A citation is the
// text of a Markdown link that points into another component: `{{AGENT_HOME}}/<location>/<path>`. The dry-run baseline, `build cite`
// and the renderer all classify through `classifyCitation`, so one rule table (citation-cases.ts) holds the three in step.
import { idProblem } from './value-problems.ts';

/** The placeholder the home folder is written as in a source repository. */
export const AGENT_HOME_PLACEHOLDER = '{{AGENT_HOME}}';

const PLACEHOLDER_PREFIX = `${AGENT_HOME_PLACEHOLDER}/`;
const COMPONENT_SEGMENT = '{component}';

/** One mount of a slot location, as the classifier needs it. */
export interface LocationRule {
  /** The slot that owns the location, for example `knowledge-storage`. */
  readonly slot: string;
  /** The location's name inside the slot, for example `content`. */
  readonly location: string;
  /** Path of the mount below the home, `/` separators; a segment `{component}` stands for the filling component's name. */
  readonly mount: string;
}

/** What a citation points at. */
export type Citation =
  | {
      readonly kind: 'location';
      readonly slot: string;
      readonly location: string;
      /** The mount with `{component}` replaced by the name it matched. */
      readonly mount: string;
      /** The name that stood for `{component}`; absent when the mount has no such segment. */
      readonly component: string | undefined;
      /** The rest of the path below the mount; empty when the citation names the mount itself. */
      readonly path: string;
    }
  | { readonly kind: 'own'; readonly path: string }
  | { readonly kind: 'placeholder'; readonly path: string };

/** Why a citation cannot be classified; `path` is the text the message names. */
export interface CitationFailure {
  /** Stable code: `under-no-location`, `unsafe-path`, `empty` or `not-a-citation`. */
  readonly code: string;
  /** The path after the placeholder, or the whole text when there is none. */
  readonly path: string;
  /** One sentence that names the path, ready to print after the citing file. */
  readonly message: string;
}

/** The outcome of classifying one link text (an expected failure is a value, ERR-1). */
export type Classified =
  { readonly ok: true; readonly citation: Citation } | { readonly ok: false; readonly failure: CitationFailure };

/** Codes of {@link CitationFailure}. */
export const CitationProblem = {
  UnderNoLocation: 'under-no-location',
  UnsafePath: 'unsafe-path',
  Empty: 'empty',
  NotACitation: 'not-a-citation',
} as const;

function refuse(code: string, path: string, message: string): Classified {
  return { ok: false, failure: { code, path, message } };
}

// The mapping entries of a parsed list; anything else is skipped, because the reader has already judged the slots file.
function entriesOf(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value)
    ? (value as unknown[]).filter(
        (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null,
      )
    : [];
}

/**
 * Lists every mount of a slots file as a rule for the classifier.
 *
 * @param slotsFile - the parsed `contracts/slots.yaml` (see readContract for the check of the file itself)
 * @param extra - mounts that are not slot locations, such as the generated `global-variables.md`, which is a core export (slots-v1.md)
 * @returns the rules in file order, then `extra`
 */
export function locationRulesFromSlots(
  slotsFile: unknown,
  extra: readonly LocationRule[] = [],
): readonly LocationRule[] {
  const slots = entriesOf((slotsFile as { slots?: unknown } | null)?.slots);
  const rules = slots.flatMap((slot) =>
    entriesOf(slot['locations']).flatMap((location) =>
      typeof slot['name'] === 'string' && typeof location['name'] === 'string' && typeof location['mount'] === 'string'
        ? [{ slot: slot['name'], location: location['name'], mount: location['mount'] }]
        : [],
    ),
  );
  return [...rules, ...extra];
}

interface Match {
  readonly rule: LocationRule;
  readonly segments: number;
  readonly literals: number;
  readonly component: string | undefined;
  readonly mount: string;
}

// Whether the mount's segments are the first segments of the path; `{component}` takes any one id.
function match(rule: LocationRule, parts: readonly string[]): Match | undefined {
  const wanted = rule.mount.split('/');
  if (wanted.length > parts.length) return undefined;
  let component: string | undefined;
  for (const [index, segment] of wanted.entries()) {
    const part = parts[index] ?? '';
    if (segment === COMPONENT_SEGMENT && idProblem(part) === undefined) component = part;
    else if (segment !== part) return undefined;
  }
  const literals = wanted.filter((segment) => segment !== COMPONENT_SEGMENT).length;
  return { rule, segments: wanted.length, literals, component, mount: parts.slice(0, wanted.length).join('/') };
}

// The longer mount wins, counted in segments so `frameworks` never wins over `frameworks/x`; on a tie the literal mount wins.
function better(candidate: Match, best: Match | undefined): boolean {
  if (best === undefined) return true;
  if (candidate.segments !== best.segments) return candidate.segments > best.segments;
  return candidate.literals > best.literals;
}

function classifyLocation(path: string, rules: readonly LocationRule[]): Classified {
  const parts = path.split('/');
  const unsafe = parts.some(
    (part, index) => part === '..' || part === '.' || (part === '' && index !== parts.length - 1),
  );
  if (path === '' || unsafe) {
    return refuse(CitationProblem.UnsafePath, path, `the path "${path}" is empty or has an empty, . or .. segment`);
  }
  const best = rules
    .map((rule) => match(rule, parts))
    .reduce<Match | undefined>(
      (found, candidate) => (candidate !== undefined && better(candidate, found) ? candidate : found),
      undefined,
    );
  if (best === undefined) {
    return refuse(CitationProblem.UnderNoLocation, path, `the path "${path}" is under no slot location`);
  }
  const rest = parts.slice(best.segments).join('/');
  return {
    ok: true,
    citation: {
      kind: 'location',
      slot: best.rule.slot,
      location: best.rule.location,
      mount: best.mount,
      component: best.component,
      path: rest,
    },
  };
}

// A text without the placeholder: the component's own file when it is a relative path, otherwise not a citation at all.
function classifyBare(text: string): Classified {
  if (text === '') return refuse(CitationProblem.Empty, text, 'the link text is empty');
  const absolute =
    text.startsWith('/') || text.startsWith('~') || text.includes('\\') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(text);
  return absolute
    ? refuse(CitationProblem.NotACitation, text, `"${text}" is neither ${PLACEHOLDER_PREFIX}<path> nor a relative path`)
    : { ok: true, citation: { kind: 'own', path: text } };
}

/**
 * Classifies the text of one Markdown link as a citation of another component, of the component's own file, or a failure.
 *
 * `{{AGENT_HOME}}/<path>` is classified by the longest slot location that prefixes the path (FR-023); a bare relative path is the
 * component's own file (AC-5.10); a path under no location fails naming the path; a path with a `<name>` placeholder segment
 * such as `companies/<co>/x.md` is left alone (A-24). Pass only the text of links whose target is not a web address.
 *
 * @param text - the link text exactly as written in the source
 * @param rules - the locations to match against, from {@link locationRulesFromSlots}
 * @returns the classification, or the failure with a message that names the path
 */
export function classifyCitation(text: string, rules: readonly LocationRule[]): Classified {
  if (!text.startsWith(PLACEHOLDER_PREFIX)) return classifyBare(text);
  const path = text.slice(PLACEHOLDER_PREFIX.length);
  if (/<[^>]*>/.test(path)) return { ok: true, citation: { kind: 'placeholder', path } };
  return classifyLocation(path, rules);
}
