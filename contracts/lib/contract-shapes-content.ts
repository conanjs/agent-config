// The shape of the content contracts the reader knows (specs/022): knowledge-provider, company-kb, rendered-copy, skill-source, agent-source and adapter-fields (T062 to T064, T066 to T068).
// contract-registry.ts joins this table with the core and the other one; shared parts come from contract-shapes.ts.
import type { ContractDefinition } from './contract-shapes.ts';

/** The content contracts by name, each with its file format and its shape per readable major. */
export const contentContracts: Readonly<Record<string, ContractDefinition>> = {};
