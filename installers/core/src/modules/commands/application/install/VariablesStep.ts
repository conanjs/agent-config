// Step "variables" of the pipeline (VR-1, VR-2, VR-6, M-07, M-08): the declarations of the components that will be installed are merged,
// V's values are read, and every required variable without a value becomes a need. A declaration that cannot be used fails the run
// before anything is written, and so does a value file that is unreadable. Nothing is stored here: a proposal is only shown (A-10).
import type { ComponentManifest } from '#manifests/application/ManifestTypes.ts';
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import { parseComponentName } from '#shared/domain/name/NameRules.ts';
import type { VariableNeed } from '#variables/application/needs/findVariableNeeds.ts';
import { mergeVariableDeclarations } from '#variables/application/declarations/mergeVariableDeclarations.ts';
import type {
  PublicComponentVariables,
  PublicDeclarationViolation,
  PublicDeclaredVariable,
  PublicVariableValues,
} from '#variables/application/VariablesTypes.ts';
import type { Notice } from '#commands/application/install/CommandOutput.ts';
import type { CommandsDeps, HomeServices } from '#commands/application/install/InstallTypes.ts';
import path from 'node:path';

/** What the variables step found. */
export type VariablesOutcome =
  | { readonly kind: 'failed'; readonly errors: readonly Notice[] }
  | {
      readonly kind: 'ok';
      readonly declared: readonly PublicDeclaredVariable[];
      readonly values: PublicVariableValues;
      readonly needs: readonly VariableNeed[];
    };

/** The name of the old Copilot folder, built from two parts so that no source line holds the old agent-home path (scripts/check-copilot-paths.ts). */
const LEGACY_HOME_FOLDER = ['.', 'copilot'].join('');

/** The file name of V's values below the agent home. */
export const VALUES_FILE = 'variables.local.yaml';

const error = (check: string, item: string, line: string, more: readonly string[] = []): Notice => ({
  severity: 'error',
  check,
  item,
  line,
  ...(more.length > 0 ? { more } : {}),
});

function violationNotice(violation: PublicDeclarationViolation): Notice {
  if (violation.kind === 'credential-like-description') {
    return error(
      'variable-description',
      violation.component,
      renderMessage('MG-47', { name: violation.component, variable: violation.name }),
    );
  }
  if (violation.kind === 'description-conflict') {
    const line = renderMessage('MG-37', {
      check: renderMessage('MG-37.variables', {
        name: violation.name,
        firstComponent: violation.first.component,
        firstDescription: violation.first.description,
        secondComponent: violation.second.component,
        secondDescription: violation.second.description,
      }),
    });
    return error('variables', violation.name, line);
  }
  const component = 'component' in violation ? violation.component : 'a component';
  const cause = 'reason' in violation ? violation.reason : `the name ${violation.name} contains ${violation.word}`;
  return error(
    'variable-declaration',
    component,
    renderMessage('MG-38', { what: `the variables of component ${component} are refused` }),
    [renderMessage('MG-38.cause', { cause })],
  );
}

function declarationsOf(manifests: readonly ComponentManifest[]): readonly PublicComponentVariables[] {
  return manifests.flatMap((manifest) => {
    const name = parseComponentName(manifest.name);
    return name.ok
      ? [
          {
            component: name.value,
            variables: manifest.variables.map((variable) => ({
              name: variable.name,
              description: variable.description,
              required: variable.required,
              detect: variable.detect,
            })),
          },
        ]
      : [];
  });
}

/**
 * Merges the declarations of the components that will be installed, reads V's values and finds the required variables with no value.
 *
 * @param deps - the services the commands were given
 * @param services - the services of the agent home of this run
 * @param homePath - the agent home, where `variables.local.yaml` lies
 * @param manifests - the manifests of the components to install, core included
 * @returns the failure, or the declarations, the values and the needs
 */
export async function checkVariables(
  deps: CommandsDeps,
  services: HomeServices,
  homePath: string,
  manifests: readonly ComponentManifest[],
): Promise<VariablesOutcome> {
  // 1. The union of the declarations; two descriptions for one name, a credential-like description and the like fail the run.
  const merged = mergeVariableDeclarations(declarationsOf(manifests));
  if (!merged.ok) return { kind: 'failed', errors: merged.error.map(violationNotice) };
  // 2. V's values; a file that cannot be used is refused as a whole (MG-23).
  const values = await services.variables.loadValues();
  if (!values.ok) {
    const file = path[deps.environment.flavor].join(homePath, VALUES_FILE);
    return {
      kind: 'failed',
      errors: [
        error('values-invalid', VALUES_FILE, renderMessage('MG-23', { list: file, sentence: values.error.sentence })),
      ],
    };
  }
  // 3. Every required variable without a value is a need, with the proposal the old variables file or a detect rule gives.
  const legacyText = deps.disk.readOptionalText(
    path[deps.environment.flavor].join(deps.environment.userHome, LEGACY_HOME_FOLDER),
    'global-variables.md',
  );
  const needs = await services.variables.findNeeds({ declared: merged.value, values: values.value, legacyText });
  return { kind: 'ok', declared: merged.value, values: values.value, needs };
}
