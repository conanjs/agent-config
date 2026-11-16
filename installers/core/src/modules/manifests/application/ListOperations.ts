import type { MergedEntry } from '#manifests/domain/model/ComponentList.ts';
import type { SlotTable } from '#manifests/domain/model/Slots.ts';
import { findSlot } from '#manifests/domain/model/Slots.ts';
import {
  mergeLists as mergeListsRule,
  splitArchiveEntries as splitArchiveRule,
} from '#manifests/domain/rules/listRules.ts';
import { isProtocolAllowed as protocolRule, type GitPolicy } from '#manifests/domain/rules/GitPolicy.ts';
import type { ComponentList } from '#manifests/domain/model/ComponentList.ts';

/**
 * Joins the public and the local list by name; a local entry wins and keeps the public source it replaced (CL-1).
 *
 * @param publicList - components.yaml
 * @param localList - components.local.yaml, possibly absent
 * @returns the merged entries in order
 */
export function mergeLists(publicList: ComponentList, localList: ComponentList): readonly MergedEntry[] {
  return mergeListsRule(publicList, localList);
}

/**
 * Splits off the archive entries, which this release recognises and skips (AC-3.7); nothing of them is fetched.
 *
 * @param entries - the merged entries
 * @returns the entries to read and the names of the skipped archive entries
 */
export function splitArchiveEntries(entries: readonly MergedEntry[]): {
  readonly usable: readonly MergedEntry[];
  readonly archiveNames: readonly string[];
} {
  return splitArchiveRule(entries);
}

/**
 * Finds a slot of slots/v1 by name.
 *
 * @param table - the slots read from slots.yaml
 * @param name - the slot name a manifest gives
 * @returns the slot, or `undefined` when slots/v1 has none by that name
 */
export function slotNamed(table: SlotTable, name: string): SlotTable['slots'][number] | undefined {
  return findSlot(table, name);
}

/**
 * Tells whether the git policy allows the transport of a source address (M-05, DR-609); the sources module asks it before a fetch.
 *
 * @param policy - the transports this run may use
 * @param url - a source address from a validated list
 * @returns true when the scheme is allowed
 */
export function isProtocolAllowed(policy: GitPolicy, url: string): boolean {
  return protocolRule(policy, url);
}
