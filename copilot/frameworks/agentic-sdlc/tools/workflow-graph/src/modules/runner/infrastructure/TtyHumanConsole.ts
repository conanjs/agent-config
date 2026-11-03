import { closeSync, openSync, readSync, writeSync } from "node:fs";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";

/** Reads the answer from `/dev/tty`, the controlling terminal: a person's shell has one, an agent's shell tool does not (specs/020 D27). */
export class TtyHumanConsole {
  /**
   * Opens `/dev/tty`, asks, and reads one line.
   *
   * @param question - shown on the terminal
   * @returns the typed line, or why there is no terminal
   */
  public ask(question: string): Promise<Result<string, string>> {
    let fd: number;
    try {
      fd = openSync("/dev/tty", "r+");
    } catch {
      return Promise.resolve(
        err(
          'no terminal: a gate decision must be typed by a person at a terminal (or as "approve G<n> <run>" in a chat session)',
        ),
      );
    }
    try {
      writeSync(fd, question);
      return Promise.resolve(ok(this.#readLine(fd)));
    } finally {
      closeSync(fd);
    }
  }

  #readLine(fd: number): string {
    const buffer = Buffer.alloc(1);
    let line = "";
    while (readSync(fd, buffer, 0, 1, null) === 1 && buffer[0] !== 10)
      line += buffer.toString("utf8");
    return line;
  }
}
