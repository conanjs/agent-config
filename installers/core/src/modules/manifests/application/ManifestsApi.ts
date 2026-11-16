import type { LinkCheck } from '#manifests/application/read/findEscapingLinks.ts';
import type { ComponentRead, ReadComponentRequest } from '#manifests/application/read/readComponent.ts';
import type { ListRequest } from '#manifests/application/read/readComponentList.ts';
import type { FileFailure, SlotsRequest } from '#manifests/application/read/readSlots.ts';
import type { ComponentList } from '#manifests/domain/model/ComponentList.ts';
import type { SlotTable } from '#manifests/domain/model/Slots.ts';
import type { Result } from '#shared/domain/result/Result.ts';

/**
 * What the manifests module offers the commands: every contract file read through the contract reader, with the disk reached only
 * through the module's ports. Built by `composeManifests` in ManifestsModule.ts and handed to the commands by the composition root.
 */
export interface ManifestsApi {
  /**
   * Reads and validates `contracts/slots.yaml` of the agent-config checkout.
   *
   * @param request - what to read
   * @returns the slot table, or the file's path with its issues (the run stops, exit 1)
   */
  readSlots(request: SlotsRequest): Result<SlotTable, FileFailure>;

  /**
   * Reads and validates one component list; an absent file is an empty list that is marked not present.
   *
   * @param request - what to read
   * @returns the list, or the file's path with its issues (the run stops, exit 1)
   */
  readComponentList(request: ListRequest): Result<ComponentList, FileFailure>;

  /**
   * Reads and validates one component folder.
   *
   * @param request - the name, root, slots and source of the component
   * @returns the manifest, why the component is skipped, or the folder that is missing
   */
  readComponent(request: ReadComponentRequest): ComponentRead;

  /**
   * Finds the first link of a component folder whose real path leaves it (the `doctor` fault of S-7).
   *
   * @param root - the absolute component root
   * @returns `clean`, the first offending link, or `unchecked`
   */
  findEscapingLinks(root: string): LinkCheck;
}
