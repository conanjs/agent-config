// A small range check for `depends.runtime` (AC-5.9): comparators joined by spaces, such as `>=24.12` or `>=24 <25`. No package is
// installed, so this covers what the contract promises and nothing more; a range it cannot read is NOT satisfied (fail closed).

type Triple = readonly [number, number, number];

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
const COMPARATOR = /^(>=|<=|>|<|=|\^|~)?v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

/**
 * Reads a version found on the machine: `v24.12.0` and `24.12.0-rc.1` give 24, 12, 0.
 *
 * @param text - what a tool printed, one version
 * @returns the three numbers, or `undefined` when the text is not a full version
 */
export function parseVersion(text: string): Triple | undefined {
  const match = VERSION.exec(text.trim());
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(left: Triple, right: Triple): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

// The numbers a comparator names, missing parts as zero, and how many parts were written.
function parts(match: RegExpExecArray): { readonly floor: Triple; readonly written: number } {
  const numbers = [match[2], match[3], match[4]];
  return {
    floor: [Number(numbers[0]), Number(numbers[1] ?? 0), Number(numbers[2] ?? 0)],
    written: numbers.filter((each) => each !== undefined).length,
  };
}

function ceilingOf(floor: Triple, written: number, caret: boolean): Triple {
  if (caret && floor[0] > 0) return [floor[0] + 1, 0, 0];
  if (caret && floor[1] > 0) return [0, floor[1] + 1, 0];
  if (caret) return written >= 3 ? [0, 0, floor[2] + 1] : [0, floor[1] + 1, 0];
  return written <= 1 ? [floor[0] + 1, 0, 0] : [floor[0], floor[1] + 1, 0];
}

type Check = (order: number, version: Triple, floor: Triple, written: number) => boolean;

// `>24.11` means above every 24.11.x and `<=24.11` up to the end of 24.11.x, as npm reads a partial version.
const above: Check = (order, version, floor, written) =>
  written >= 3 ? order > 0 : compare(version, ceilingOf(floor, written, false)) >= 0;
const upTo: Check = (order, version, floor, written) =>
  written >= 3 ? order <= 0 : compare(version, ceilingOf(floor, written, false)) < 0;
const within =
  (caret: boolean): Check =>
  (order, version, floor, written) =>
    order >= 0 && compare(version, ceilingOf(floor, written, caret)) < 0;

const CHECKS: Readonly<Record<string, Check>> = {
  '>=': (order) => order >= 0,
  '>': above,
  '<=': upTo,
  '<': (order) => order < 0,
  '^': within(true),
  '~': within(false),
  '=': (order, version, floor, written) =>
    written >= 3 ? order === 0 : order >= 0 && compare(version, ceilingOf(floor, written, false)) < 0,
};

/**
 * Tells whether a version satisfies a range: every comparator of the range must hold.
 *
 * @param range - the requirement a manifest writes, for example `>=24.12`
 * @param found - the version the machine reports, with or without a leading v
 * @returns false for an unreadable range or version, so a requirement that cannot be checked is not met
 */
export function satisfiesRange(range: string, found: string): boolean {
  const version = parseVersion(found);
  const comparators = range.trim().split(/\s+/);
  if (version === undefined || comparators.length === 0 || comparators.some((each) => each === '')) return false;
  return comparators.every((comparator) => {
    const match = COMPARATOR.exec(comparator);
    if (match === null) return false;
    const { floor, written } = parts(match);
    const check = CHECKS[match[1] ?? '='];
    return check !== undefined && check(compare(version, floor), version, floor, written);
  });
}
