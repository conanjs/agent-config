import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";

/** Reads a JSON Lines session log and tells whether any user message in it contains a text. Each agent supplies how to find user messages. */
export class JsonlLog {
  /**
   * Returns whether some user message contains the text, or why the file cannot be read.
   *
   * @param file - path of the agent's JSON Lines session log
   * @param text - the text to find
   * @param userTexts - returns the user-message texts of one parsed line (empty for other lines)
   * @returns whether some user message contains the text, or why the file cannot be read
   */
  public async contains(
    file: string | undefined,
    text: string,
    userTexts: (line: Record<string, unknown>) => string[],
  ): Promise<Result<boolean, string>> {
    if (file === undefined || !existsSync(file))
      return err(`session log ${file ?? "(unknown)"} not found`);
    const wanted = text.trim();
    for (const line of (await readFile(file, "utf8")).split("\n")) {
      if (line.trim() === "") continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        userTexts(parsed as Record<string, unknown>).some((t) => t.includes(wanted))
      )
        return ok(true);
    }
    return ok(false);
  }
}
