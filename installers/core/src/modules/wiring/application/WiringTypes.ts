// The public types of the wiring module. Other modules import only `application/**` and a re-export is not allowed (TSN-18), so each
// domain type they need is named here as an alias of the declaring type.
import type { CompatPlan, CompatOperation, OldContent, Observation } from '#wiring/domain/compat/CompatPlan.ts';
import type { RecordedLink, RetiredDecision, RetiredEntry } from '#wiring/domain/compat/RetiredList.ts';
import type {
  ApprovedRecord,
  PrivilegedDiff,
  PrivilegedEntry,
  PrivilegedRefusal,
  PrivilegedSource,
} from '#wiring/domain/privileged/PrivilegedSet.ts';

/** The plan of compatibility links: operations, unchanged paths, skipped paths and folders to ensure. */
export type WiringCompatPlan = CompatPlan;
/** One compatibility link to create, switch or put over a real entry. */
export type WiringCompatOperation = CompatOperation;
/** What a path held before the run. */
export type WiringOldContent = OldContent;
/** What is at a path now. */
export type WiringObservation = Observation;
/** One entry of the retired list. */
export type WiringRetiredEntry = RetiredEntry;
/** A compatibility link the install state recorded. */
export type WiringRecordedLink = RecordedLink;
/** What happens to one retired path. */
export type WiringRetiredDecision = RetiredDecision;
/** One hook, route or service that needs V's approval. */
export type WiringPrivilegedEntry = PrivilegedEntry;
/** A component's privileged parts and commit. */
export type WiringPrivilegedSource = PrivilegedSource;
/** An approval recorded in the install state. */
export type WiringApprovedRecord = ApprovedRecord;
/** What is new, changed or removed against the approval. */
export type WiringPrivilegedDiff = PrivilegedDiff;
/** Why a privileged entry is refused. */
export type WiringPrivilegedRefusal = PrivilegedRefusal;
