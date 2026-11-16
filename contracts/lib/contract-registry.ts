// Every contract the reader knows (specs/022): the core, content and tooling tables joined into one, by contract name.
import { contentContracts } from './contract-shapes-content.ts';
import { toolingContracts } from './contract-shapes-tooling.ts';
import { type ContractDefinition, coreContracts } from './contract-shapes.ts';

/** All contracts the reader can read, by name; a name in two tables is a programming error caught by a unit test. */
export const contractDefinitions: Readonly<Record<string, ContractDefinition>> = {
  ...coreContracts,
  ...contentContracts,
  ...toolingContracts,
};
