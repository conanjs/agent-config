// The two checks that read data other than the dependency lists: cited docs against exports (AC-5.6, FR-022) and declared runtimes
// against what the machine reports (AC-5.9, FR-024).
import type { CitedPath, ManifestView, Placed, ResolutionError } from '#resolution/domain/model/Resolution.ts';
import { satisfiesRange } from '#resolution/domain/runtime/versionRange.ts';

const byText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const citationKey = (citation: CitedPath): string => `${citation.consumer}\0${citation.file}\0${citation.locationPath}`;

/**
 * Checks every citation of another component against the exports of the provider of the cited slot.
 *
 * A citation into a slot nobody fills is left to the dependency check (a need, or nothing for an optional dependency). When a slot
 * has several providers the citation is fine if any of them exports the path; otherwise the first provider by name is named.
 *
 * @param placed - the components that stay
 * @param citations - the classified citations of their files
 * @returns one error per citation that no provider exports, ordered by consumer, file and path
 */
export function checkCitations(
  placed: readonly Placed<ManifestView>[],
  citations: readonly CitedPath[],
): readonly ResolutionError[] {
  const staying = new Set(placed.map((each) => each.name));
  return [...citations]
    .sort((left, right) => byText(citationKey(left), citationKey(right)))
    .flatMap((citation): ResolutionError[] => {
      const providers = placed
        .filter((each) => each.slot === citation.slot && each.name !== citation.consumer)
        .sort((left, right) => byText(left.name, right.name));
      const [first] = providers;
      const exported = providers.some((each) => each.manifest.provides.exports.includes(citation.locationPath));
      return staying.has(citation.consumer) && first !== undefined && !exported
        ? [
            {
              kind: 'export',
              consumer: citation.consumer,
              file: citation.file,
              path: citation.locationPath,
              provider: first.name,
            },
          ]
        : [];
    });
}

/**
 * Checks the runtime ranges every component declares against the versions found on the machine.
 *
 * @param placed - the components that stay, in name order
 * @param found - the versions by tool name; a tool that is not listed counts as not found, so it is not met
 * @returns one error per component and tool whose requirement is not met, tools in name order
 */
export function checkRuntime(
  placed: readonly Placed<ManifestView>[],
  found: Readonly<Record<string, string>>,
): readonly ResolutionError[] {
  return placed.flatMap((each) =>
    Object.entries(each.manifest.depends.runtime)
      .sort(([left], [right]) => byText(left, right))
      .flatMap(([tool, range]): ResolutionError[] => {
        const version = Object.hasOwn(found, tool) ? found[tool] : undefined;
        return version !== undefined && satisfiesRange(range, version)
          ? []
          : [{ kind: 'runtime', component: each.name, tool, range, found: version?.replace(/^v/, '') ?? 'not found' }];
      }),
  );
}
