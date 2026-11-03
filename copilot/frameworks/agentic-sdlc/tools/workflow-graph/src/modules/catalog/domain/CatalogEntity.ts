/** One entity of a Backstage-format `catalog-info.yaml`: a component, or an API with the file that describes it. */
export type CatalogEntity = {
  /** `Component`, `API`, `Location` … */
  readonly kind: string;
  /** `metadata.name`, e.g. `workflow-graph-cli`. */
  readonly name: string;
  /** For an API, `spec.definition.$text`: the description file, relative to the catalog file. */
  readonly definition: string | undefined;
};
