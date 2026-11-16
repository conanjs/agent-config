// AC-6.3, VR-3, MG-36: when V types a name no enabled component declares, the installer names the declared names that are one
// typing mistake away. Pure and bounded: names are at most 128 characters and a pair whose lengths differ by more than the limit is
// skipped without a comparison, so a hostile list of declarations cannot make this slow (M-13 spirit).
import { MAX_VARIABLE_NAME_LENGTH } from '#variables/domain/name/VariableName.ts';

/** The largest edit distance (insertions, deletions, substitutions) at which a declared name is suggested. */
export const MAX_SUGGESTION_DISTANCE = 3;

/** The most names suggested. */
export const MAX_SUGGESTIONS = 3;

// Levenshtein distance with two rows; the caller has already checked that the lengths differ by at most the limit.
function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_unused, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      const substitution = (previous[column - 1] ?? 0) + (left[row - 1] === right[column - 1] ? 0 : 1);
      current.push(Math.min(substitution, (previous[column] ?? 0) + 1, (current[column - 1] ?? 0) + 1));
    }
    previous = current;
  }
  return previous[right.length] ?? 0;
}

/**
 * Picks the declared names closest to a name V typed: edit distance 3 or less, nearest first, equal distances in alphabetical
 * order, at most 3.
 *
 * The typed name is compared in upper case, so `langauge` finds `LANGUAGE`. A typed name longer than 128 characters finds nothing.
 *
 * @param typed - what V typed before the `=`
 * @param declared - the names of the declared variables, in any order, with or without repeats
 * @returns up to three names, nearest first
 */
export function closestNames(typed: string, declared: readonly string[]): string[] {
  if (typed.length > MAX_VARIABLE_NAME_LENGTH) return [];
  const folded = typed.toUpperCase();
  const scored: { name: string; distance: number }[] = [];
  for (const name of new Set(declared)) {
    if (Math.abs(name.length - folded.length) > MAX_SUGGESTION_DISTANCE) continue;
    const distance = editDistance(folded, name);
    if (distance <= MAX_SUGGESTION_DISTANCE) scored.push({ name, distance });
  }
  return scored
    .sort(
      (left, right) => left.distance - right.distance || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0),
    )
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => entry.name);
}
