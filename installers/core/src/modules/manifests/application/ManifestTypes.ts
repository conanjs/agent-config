// The types of the manifests module that other modules use. Another module imports only application/** (MOD-3) and a re-export is
// not allowed (TSN-18), so each type is named again here as an alias of the domain type.
import type * as Component from '#manifests/domain/model/Component.ts';
import type * as List from '#manifests/domain/model/ComponentList.ts';
import type * as Issues from '#manifests/domain/model/Issues.ts';
import type * as Slots from '#manifests/domain/model/Slots.ts';
import type * as Policy from '#manifests/domain/rules/GitPolicy.ts';

/** One validated `component.yaml`. */
export type ComponentManifest = Component.ComponentManifest;
/** A hook a component asks the installer to merge (privileged, M-01). */
export type HookEntry = Component.HookEntry;
/** A route a component offers (privileged, M-01). */
export type RouteEntry = Component.RouteEntry;
/** A service a component registers (privileged, M-01). */
export type ServiceEntry = Component.ServiceEntry;
/** A public variable a component declares (M-08). */
export type VariableDeclaration = Component.VariableDeclaration;
/** One validated component list. */
export type ComponentList = List.ComponentList;
/** Where a component comes from: git, path or archive. */
export type ComponentSource = List.ComponentSource;
/** One line of a list. */
export type ListEntry = List.ListEntry;
/** One entry of the merged lists, with the public source it replaced. */
export type MergedEntry = List.MergedEntry;
/** One component the run leaves out, and why. */
export type ComponentSkip = Issues.ComponentSkip;
/** Why a whole list or slots file is refused. */
export type FileIssue = Issues.FileIssue;
/** Why one component is skipped. */
export type SkipReason = Issues.SkipReason;
/** One socket of slots.yaml. */
export type Slot = Slots.Slot;
/** One location of a slot. */
export type SlotLocation = Slots.SlotLocation;
/** The slots of one slots.yaml. */
export type SlotTable = Slots.SlotTable;
/** The git transports a run may use. */
export type GitPolicy = Policy.GitPolicy;
/** A git transport. */
export type GitProtocol = Policy.GitProtocol;
