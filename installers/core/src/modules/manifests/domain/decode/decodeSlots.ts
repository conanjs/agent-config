import { asFlag, asList, asMapping, asText, asTextList } from '#manifests/domain/decode/Fields.ts';
import type { Scope, Slot, SlotLocation, SlotTable } from '#manifests/domain/model/Slots.ts';

function decodeScope(value: unknown): Scope {
  return value === 'per-project' ? 'per-project' : 'global';
}

function decodeLocation(value: unknown): SlotLocation {
  const location = asMapping(value);
  const index = location['index'];
  return {
    name: asText(location['name']),
    mount: asText(location['mount']),
    required: asFlag(location['required'], true),
    shared: asFlag(location['shared'], false),
    index: index === 'provided' || index === 'generated' ? index : undefined,
  };
}

function decodeSlot(value: unknown): Slot {
  const slot = asMapping(value);
  const contract = slot['contract'];
  return {
    name: asText(slot['name']),
    reserved: asFlag(slot['reserved'], false),
    contracts: typeof contract === 'string' ? [contract] : asTextList(contract),
    required: asFlag(slot['required'], false),
    multiple: asFlag(slot['multiple'], false),
    scope: decodeScope(slot['scope']),
    selfContained: asFlag(slot['self-contained'], false),
    locations: asList(slot['locations']).map(decodeLocation),
  };
}

/**
 * Turns a slots/v1 document that the contract reader accepted into the slot table.
 *
 * @param document - the parsed, checked document
 * @returns the slots in file order
 */
export function decodeSlots(document: Readonly<Record<string, unknown>>): SlotTable {
  return { slots: asList(document['slots']).map(decodeSlot) };
}
