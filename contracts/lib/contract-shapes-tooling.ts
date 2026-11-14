// The shape of the tooling contracts the reader knows (specs/022): routes, build, repo-layout, hooks, variables and framework (T065, T069 to T073).
// contract-registry.ts joins this table with the core and the other one; shared parts come from contract-shapes.ts.
import type { ContractDefinition } from './contract-shapes.ts';

/** The tooling contracts by name, each with its file format and its shape per readable major. */
export const toolingContracts: Readonly<Record<string, ContractDefinition>> = {};
