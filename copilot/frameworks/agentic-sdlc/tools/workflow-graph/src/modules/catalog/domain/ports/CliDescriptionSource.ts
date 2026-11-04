import type { Result } from "#src/modules/shared/domain/Result.ts";
import type { CliDescription } from "#src/modules/catalog/domain/CliDescription.ts";

/** Where the program's command-line description comes from (its usage spec file). */
export interface CliDescriptionSource {
  /**
   * Returns the program description parsed from the spec file, or why the file cannot be used.
   *
   * @returns the description, or why the file cannot be read or parsed
   */
  load(): Promise<Result<CliDescription, string>>;
}
