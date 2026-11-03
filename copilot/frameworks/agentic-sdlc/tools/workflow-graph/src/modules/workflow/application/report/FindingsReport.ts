import type { CommandOutput } from "#src/modules/shared/domain/CommandOutput.ts";
import type { Finding } from "#src/modules/workflow/domain/graph/Finding.ts";

/** Prints findings the way the framework's validators do: a header, one `  WG-n  where: message` line each, then `PASS (n warning(s))` or `FAIL (n)`. */
export class FindingsReport {
  /**
   * Returns the text and exit code 1 when there is an error, else 0.
   *
   * @param header - the first line, such as `workflow-graph check-run: R-007`
   * @param findings - errors and warnings
   * @returns the text and exit code 1 when there is an error, else 0
   */
  public render(header: string, findings: readonly Finding[]): CommandOutput {
    const errors = findings.filter((f) => f.warning !== true);
    const lines = findings.map((f) => `  ${f.code}  ${f.where}: ${f.message}`);
    const verdict =
      errors.length > 0 ? `FAIL (${errors.length})` : `PASS (${findings.length} warning(s))`;
    return { code: errors.length > 0 ? 1 : 0, out: [header, ...lines, verdict].join("\n") };
  }
}
