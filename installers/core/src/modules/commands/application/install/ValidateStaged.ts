// The checks of the staged trees (DR-202, FR-026, AC-7.2): before any link moves, every component to install is read once more from the
// tree its links will point into, and each path it exports must be there. A `git` source was copied into `store/` by this run, so this
// reads the copy; a `path` source and agent-config's own checkout are read where they lie. Any failure keeps the previous links.
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { Slot, SlotTable } from '#manifests/application/ManifestTypes.ts';
import { VARIABLES_MOUNT } from '#commands/application/install/CitationScan.ts';
import type { Notice } from '#commands/application/install/CommandOutput.ts';
import type { CommandsDeps } from '#commands/application/install/InstallTypes.ts';
import type { InstalledComponent } from '#commands/application/install/PlanInstall.ts';

const failure = (check: string, item: string, detail: string): Notice => ({
  severity: 'error',
  check,
  item,
  line: renderMessage('MG-37', { check: detail }),
});

// The file an export names, below the component root: the longest mount of the slot that prefixes the exported path decides the
// location, and the manifest says which folder holds it. `undefined` when no location matches or the manifest does not map it.
function exportedFile(component: InstalledComponent, slot: Slot | undefined, exported: string): string | undefined {
  const mounts = (slot?.locations ?? [])
    .map((location) => ({ name: location.name, mount: location.mount.replace('{component}', component.name) }))
    .filter(({ mount }) => exported === mount || exported.startsWith(`${mount}/`))
    .sort((left, right) => right.mount.length - left.mount.length);
  const best = mounts[0];
  const folder = best === undefined ? undefined : component.manifest.locations[best.name];
  if (best === undefined || folder === undefined) return undefined;
  const rest = exported.slice(best.mount.length).replace(/^\//, '');
  return [folder, rest].filter((part) => part !== '' && part !== '.').join('/');
}

function checkExports(deps: CommandsDeps, slots: SlotTable, component: InstalledComponent): readonly Notice[] {
  const slot = slots.slots.find((each) => each.name === component.slot);
  return component.manifest.provides.exports.flatMap((exported) => {
    // The generated variables file is a core export that no folder of the checkout holds (slots-v1.md).
    if (component.origin === 'core' && exported === VARIABLES_MOUNT.mount) return [];
    const file = exportedFile(component, slot, exported);
    const there = file !== undefined && deps.disk.entryKind(component.contentRoot, file) !== 'missing';
    const detail = renderMessage('MG-37.exports', { component: component.name, path: exported });
    return there ? [] : [failure('exports', component.name, detail)];
  });
}

function checkSchema(deps: CommandsDeps, slots: SlotTable, component: InstalledComponent): readonly Notice[] {
  if (component.origin !== 'git') return [];
  const read = deps.manifests.readComponent({
    name: component.name,
    root: component.contentRoot,
    slots,
    source: { kind: 'clone' },
  });
  const detail = renderMessage('MG-37.schema', { component: component.name });
  return read.kind === 'loaded' ? [] : [failure('schema', component.name, detail)];
}

/**
 * Checks every component to install against the tree its links will point into.
 *
 * @param deps - the services the commands were given
 * @param slots - the slot table
 * @param components - the components to install, with their staged or live folders
 * @returns one error per failed check, naming the check and the component (MG-37); empty when every tree passes
 */
export function validateStaged(
  deps: CommandsDeps,
  slots: SlotTable,
  components: readonly InstalledComponent[],
): readonly Notice[] {
  return components.flatMap((component) => [
    ...checkSchema(deps, slots, component),
    ...checkExports(deps, slots, component),
  ]);
}

/**
 * Gives the components as they can be checked before their git trees are staged: a tree that is not in the store yet is checked in the
 * clone it will be copied from, which holds the same files.
 *
 * @param deps - the services the commands were given
 * @param components - the components to install
 * @returns the same components, with the folder to check in place of a staged tree that does not exist yet
 */
export function checkableComponents(
  deps: CommandsDeps,
  components: readonly InstalledComponent[],
): readonly InstalledComponent[] {
  return components.map((component) =>
    component.origin === 'git' && deps.disk.observe(component.contentRoot).kind === 'absent'
      ? { ...component, contentRoot: component.sourceRoot }
      : component,
  );
}
