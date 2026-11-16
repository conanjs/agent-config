// The slots a component can fill, as the installer holds them after reading `contracts/slots.yaml` (slots/v1, data-model "Slot").

/** Where a slot or a component applies: once for the whole home, or once per project. */
export type Scope = 'global' | 'per-project';

/** One location of a slot: a name a component maps to one of its folders, and the mount where the home shows it. */
export interface SlotLocation {
  /** The location name, such as `content`. */
  readonly name: string;
  /** The path below the home where the location is mounted; `{component}` stands for the component name in a per-project slot. */
  readonly mount: string;
  /** Whether a component must supply the location (default true). */
  readonly required: boolean;
  /** Whether the location is linked entry by entry instead of as a whole folder (FR-027). */
  readonly shared: boolean;
  /** Whether `index.md` is supplied by the component, generated, or neither. */
  readonly index: 'provided' | 'generated' | undefined;
}

/** One socket of slots.yaml. */
export interface Slot {
  /** The slot name, such as `knowledge-storage`. */
  readonly name: string;
  /** True for a slot that only agent-config's own component fills. */
  readonly reserved: boolean;
  /** Every contract the filler must offer (SL-2): a one-item list for a single contract. */
  readonly contracts: readonly string[];
  /** Whether install needs a filler. */
  readonly required: boolean;
  /** Whether more than one component may fill it. */
  readonly multiple: boolean;
  /** Where the slot applies. */
  readonly scope: Scope;
  /** True when fillers cite no other component (DR-404). */
  readonly selfContained: boolean;
  /** The locations of the slot, at least one. */
  readonly locations: readonly SlotLocation[];
}

/** The slots of one slots.yaml, in file order. */
export interface SlotTable {
  /** The slots. */
  readonly slots: readonly Slot[];
}

/**
 * Looks up the slot a manifest names, so an unknown slot can skip only that component.
 *
 * @param table - the slots read from slots.yaml
 * @param name - the slot name a manifest gives
 * @returns the slot, or `undefined` when slots/v1 has no such slot
 */
export function findSlot(table: SlotTable, name: string): Slot | undefined {
  return table.slots.find((slot) => slot.name === name);
}
