// The types of the resolution module that other modules use. Another module imports only application/** (MOD-3) and a re-export is
// not allowed (TSN-18), so each type is named again here as an alias of the domain type.
import type { ComponentManifest } from '#manifests/application/ManifestTypes.ts';
import type * as Model from '#resolution/domain/model/Resolution.ts';

/** One component of a list with its valid manifest. */
export type Candidate = Model.Candidate<ComponentManifest>;
/** What the resolver reads. */
export type ResolveInput = Model.ResolveInput<ComponentManifest>;
/** A citation of another component's file, classified by slot. */
export type CitedPath = Model.CitedPath;
/** What the resolver decided. */
export type ResolutionResult = Model.ResolutionResult<ComponentManifest>;
/** A component that will be installed. */
export type Placed = Model.Placed<ComponentManifest>;
/** A slot nothing fills. */
export type ComponentNeed = Model.ComponentNeed;
/** A failure of resolution. */
export type ResolutionError = Model.ResolutionError;
/** An optional dependency without a provider. */
export type OptionalGap = Model.OptionalGap;
