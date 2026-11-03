import { execFile } from "node:child_process";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";

/** Runs one program with no stdin, in a folder, with a time limit, and returns its output. */
export class CommandRunner {
  /**
   * Returns stdout, or the exit code and the end of stderr when it failed.
   *
   * @param program - the executable
   * @param args - its arguments
   * @param cwd - the working folder
   * @param timeoutMs - killed after this many milliseconds
   * @returns stdout, or the exit code and the end of stderr when it failed
   */
  public run(
    program: string,
    args: readonly string[],
    cwd: string,
    timeoutMs: number,
  ): Promise<Result<string, string>> {
    return new Promise((resolve) => {
      const child = execFile(
        program,
        [...args],
        { cwd, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
        (error, stdout, stderr) => {
          if (error)
            resolve(
              err(
                `${program} failed (${error.code ?? error.signal ?? "error"}): ${stderr.trim().split("\n").slice(-3).join(" ")}`,
              ),
            );
          else resolve(ok(stdout));
        },
      );
      child.stdin?.end();
    });
  }
}
