// FR-022, FR-023, AC-5.6: finds the citations of other components in the Markdown files of a component, so the resolver can check
// each against the exports of the provider. A citation is the text of a Markdown link that starts with the agent-home placeholder;
// the shared classifier (contracts/lib, through NameRules) says which slot it points into. Pure: the files are read by the DiskReader.
import { CITATION_PREFIX, classifyCitationText, type CitationMount } from '#shared/domain/name/NameRules.ts';
import type { SlotTable } from '#manifests/application/ManifestTypes.ts';
import type { CitedPath } from '#resolution/application/ResolutionTypes.ts';
import type { MarkdownFile } from '#commands/application/ports/CommandPorts.ts';

const LINK = /\[([^\]\n]*)\]\(([^)\n]*)\)/g;
const FENCE = /^\s{0,3}(```|~~~)/;

/** The mount of the generated variables file, which is a core export and not a slot location (slots-v1.md). */
export const VARIABLES_MOUNT: CitationMount = { slot: 'core', location: 'variables', mount: 'global-variables.md' };

/**
 * Lists every mount of slots/v1 for the citation classifier, plus the generated variables file.
 *
 * @param slots - the slot table
 * @returns one mount per slot location, then the variables mount
 */
export function citationMounts(slots: SlotTable): readonly CitationMount[] {
  return [
    ...slots.slots.flatMap((slot) =>
      slot.locations.map((location) => ({ slot: slot.name, location: location.name, mount: location.mount })),
    ),
    VARIABLES_MOUNT,
  ];
}

/**
 * Finds the text of every Markdown link that starts with the placeholder, skipping fenced code blocks.
 *
 * @param markdown - the text of one file
 * @returns the link texts in file order, duplicates kept
 */
export function citationTexts(markdown: string): readonly string[] {
  const texts: string[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const match of line.matchAll(LINK)) {
      const text = match[1] ?? '';
      if (text.startsWith(CITATION_PREFIX)) texts.push(text);
    }
  }
  return texts;
}

/**
 * Classifies every citation in the files of one component.
 *
 * @param consumer - the component whose files these are
 * @param files - its Markdown files
 * @param mounts - the mounts of slots/v1
 * @returns one entry per distinct citing file and cited path, in file then path order
 */
export function citationsOf(
  consumer: string,
  files: readonly MarkdownFile[],
  mounts: readonly CitationMount[],
): readonly CitedPath[] {
  const found = new Map<string, CitedPath>();
  for (const file of files) {
    for (const text of citationTexts(file.text)) {
      const classified = classifyCitationText(text, mounts);
      if (classified.kind !== 'location') continue;
      found.set(`${file.file}\0${classified.locationPath}`, {
        consumer,
        file: file.file,
        slot: classified.slot,
        locationPath: classified.locationPath,
      });
    }
  }
  return [...found.values()];
}
