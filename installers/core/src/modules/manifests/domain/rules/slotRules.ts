// Rules across the slot table and between a manifest and its slot, which the contract reader cannot see because they need two
// parts of a file or two files (slots/v1 SL-1 to SL-5, data-model "Slot" invariants, component/v1 A-4, AC-5.8).
import path from 'node:path';
import type { ComponentManifest } from '#manifests/domain/model/Component.ts';
import type { SkipReason } from '#manifests/domain/model/Issues.ts';
import { findSlot, type SlotTable } from '#manifests/domain/model/Slots.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';

/**
 * Looks for faults inside a slot table that the reader cannot see: a slot name, a location name in one slot or a mount that appears
 * twice (the mounts are what citations are classified by, AC-5.10).
 *
 * @param table - slots the contract reader accepted
 * @returns one sentence per fault, in file order; none for a good table
 */
export function slotTableProblems(table: SlotTable): readonly string[] {
  const problems: string[] = [];
  const slotNames = new Set<string>();
  const mounts = new Set<string>();
  table.slots.forEach((slot, slotIndex) => {
    if (slotNames.has(slot.name)) problems.push(`slots[${slotIndex}].name appears twice`);
    slotNames.add(slot.name);
    const locationNames = new Set<string>();
    slot.locations.forEach((location, locationIndex) => {
      const field = `slots[${slotIndex}].locations[${locationIndex}]`;
      if (locationNames.has(location.name)) problems.push(`${field}.name appears twice in the slot`);
      locationNames.add(location.name);
      if (mounts.has(location.mount)) problems.push(`${field}.mount is used by another location (DR-416)`);
      mounts.add(location.mount);
    });
  });
  return problems;
}

/** Who named the component: a list entry, or agent-config itself for its own manifest. */
export type ComponentOrigin = 'list' | 'core';

/**
 * Checks a manifest against the slot it names: the slot exists in slots/v1 (AC-5.8), a reserved slot is filled only by the core
 * component (SL-5), every required location of the slot is supplied and no location is named that the slot lacks (A-4).
 *
 * @param manifest - a manifest the contract reader accepted
 * @param table - the slots of slots/v1
 * @param origin - `list` for a component a list names, `core` for agent-config's own manifest
 * @returns why the component is skipped, or `undefined` when it fits its slot
 */
export function checkAgainstSlot(
  manifest: ComponentManifest,
  table: SlotTable,
  origin: ComponentOrigin,
): SkipReason | undefined {
  const slot = findSlot(table, manifest.slot);
  if (slot === undefined) return { kind: 'unknown-slot', slot: manifest.slot };
  if (slot.reserved && origin === 'list') {
    return { kind: 'invalid', sentence: `slot ${slot.name} is reserved for agent-config's own component` };
  }
  const supplied = Object.keys(manifest.locations);
  const missing = slot.locations.find((location) => location.required && !supplied.includes(location.name));
  if (missing !== undefined) {
    return { kind: 'invalid', sentence: `locations.${missing.name} is required by slot ${slot.name}` };
  }
  const unknown = supplied.find((name) => !slot.locations.some((location) => location.name === name));
  return unknown === undefined
    ? undefined
    : { kind: 'invalid', sentence: `locations.${unknown} is not a location of slot ${slot.name}` };
}

/**
 * Lists the path fields of a manifest that point into the component's own folder, so each can be proven to stay under the root
 * (M-03, CM-3). Route files and exports are paths below the home, not below the component, so they are not listed.
 *
 * @param manifest - a manifest the contract reader accepted
 * @returns the field name and the relative path of each, in a fixed order
 */
export function ownFolderPaths(manifest: ComponentManifest): readonly (readonly [field: string, path: string])[] {
  const locations = Object.entries(manifest.locations).map(([name, folder]) => [`locations.${name}`, folder] as const);
  const provided = [
    ['provides.index', manifest.provides.index],
    ['provides.skills', manifest.provides.skills],
    ['provides.agents', manifest.provides.agents],
  ] as const;
  return [
    ...locations,
    ...provided.flatMap(([field, value]) => (value === undefined ? [] : ([[field, value]] as const))),
  ];
}

const FIRST_SEGMENT = /^(?:\.\/)*([^/]*)/;

/**
 * Tells whether a path field points into a folder named `.git` at the component root, however its letters are cased (M-04).
 * Both spellings are tested: the text as written (`.GIT`), and the canonical path below the canonical root, which the file system
 * has already rewritten (a Windows short name such as `GIT~1` is expanded to `.git` there).
 *
 * @param written - the path field as the component wrote it
 * @param realRoot - the canonical component root
 * @param realPath - the canonical path of the field
 * @param flavor - the path syntax of the machine
 * @returns true when either spelling starts with a `.git` segment
 */
export function pointsIntoGitFolder(written: string, realRoot: string, realPath: string, flavor: PathFlavor): boolean {
  const flavored = path[flavor];
  const canonical = flavored.relative(realRoot, realPath).split(flavored.sep)[0] ?? '';
  const lexical = FIRST_SEGMENT.exec(written)?.[1] ?? '';
  return [canonical, lexical].some((segment) => segment.toLowerCase() === '.git');
}
