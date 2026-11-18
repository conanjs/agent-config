// What the report says a run changes, from the plan (DR-306): a backup before each path that is replaced, then the link or the file, then
// each removed link. `plan` prints these as `would` lines and `install` puts the same list in the report it ends with, so the two agree (TR-4).
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { ReportChange } from '#shared/domain/report/InstallReport.ts';
import type { BuiltPlan } from '#commands/application/install/BuildPlan.ts';

/**
 * Lists the changes a plan makes, in the order they are made.
 *
 * @param built - the plan of the run
 * @returns the generated files first, then the links, then the removals; each replaced path is preceded by its backup
 */
export function changesOf(built: BuiltPlan): readonly ReportChange[] {
  const { plan } = built;
  const writes = plan.writes
    .filter((step) => !step.unchanged)
    .flatMap((step): ReportChange[] => [
      ...(step.exists
        ? [
            {
              op: 'backup' as const,
              path: step.path,
              class: 'generated' as const,
              component: 'core',
              privileged: false,
            },
          ]
        : []),
      { op: 'write', path: step.path, hash: step.file.hash, class: 'generated', component: 'core', privileged: false },
    ]);
  const links = plan.links
    .filter((step) => step.how !== 'unchanged')
    .flatMap((step): ReportChange[] => [
      ...(step.how === 'replace'
        ? [{ op: 'backup' as const, path: step.path, class: step.class, component: step.component, privileged: false }]
        : []),
      {
        op: 'link',
        path: step.path,
        target: step.target,
        class: step.class,
        component: step.component,
        privileged: false,
      },
    ]);
  const removals = plan.unlinks.map((step): ReportChange => ({
    op: 'remove',
    path: step.path,
    class: 'linked',
    component: 'core',
    privileged: false,
  }));
  return [...writes, ...links, ...removals];
}

/**
 * Writes the `would` lines of a `plan` run (MG-48).
 *
 * @param changes - the changes of the plan
 * @returns one line per change, in order
 */
export function wouldLines(changes: readonly ReportChange[]): readonly string[] {
  return changes.map((change) => renderMessage('MG-48', { operation: change.op, path: change.path }));
}
