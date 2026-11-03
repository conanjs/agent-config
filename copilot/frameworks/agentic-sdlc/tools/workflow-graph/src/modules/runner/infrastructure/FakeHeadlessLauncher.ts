import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type {
  HeadlessLaunch,
  HeadlessLauncher,
  HeadlessResult,
} from "#src/modules/coding-agents/domain/ports/HeadlessLauncher.ts";

/**
 * Scripted replies for scenarios (wired only when WORKFLOW_GRAPH_FAKE_REPLIES names a file). Keys are
 * `<phase or task>:<role>:<mode>`, values lists of reply types used in turn (`artifact`, `review-pass`,
 * `review-fail:fixable`, `question`; `*` as key is the default). An execute launch writes `<role>-<what>.txt`.
 */
export class FakeHeadlessLauncher implements HeadlessLauncher {
  readonly #file: string;

  /**
   * Reads its scripted replies from one file, and counts their use in a file beside it.
   *
   * @param file - the JSON file of scripted replies; its use counts are kept next to it
   */
  public constructor(file: string) {
    this.#file = file;
  }

  /**
   * {@link HeadlessLauncher.commandFor}: no real program; names the role and mode for logs.
   */
  public commandFor(launch: HeadlessLaunch): readonly string[] {
    return ["fake", launch.role, launch.mode];
  }

  /**
   * {@link HeadlessLauncher.launch}: answers with the next scripted reply for the launch key and, in execute mode, writes a file so git has a change.
   */
  public launch(launch: HeadlessLaunch): Promise<Result<HeadlessResult, string>> {
    const what =
      /^task: "(T\d+)/m.exec(launch.prompt)?.[1] ??
      /^phase: (P\d+)/m.exec(launch.prompt)?.[1] ??
      "?";
    const key = `${what}:${launch.role}:${launch.mode}`;
    const script = JSON.parse(readFileSync(this.#file, "utf8")) as Record<string, string[]>;
    const countsFile = `${this.#file}.counts.json`;
    const counts = existsSync(countsFile)
      ? (JSON.parse(readFileSync(countsFile, "utf8")) as Record<string, number>)
      : {};
    const list = script[key] ?? script["*"] ?? [];
    const used = counts[key] ?? 0;
    writeFileSync(countsFile, JSON.stringify({ ...counts, [key]: used + 1 }));
    const reply = list[Math.min(used, list.length - 1)];
    if (reply === undefined) return Promise.resolve(err(`no scripted reply for ${key}`));
    if (launch.mode === "execute")
      writeFileSync(join(launch.cwd, `${launch.role}-${what}.txt`), `attempt ${used + 1}\n`);
    const [type, reason] = reply.split(":");
    return Promise.resolve(
      ok({
        reply: `schema: message/v2\nfrom: ${launch.role}\nmode: ${launch.mode}\ntype: ${type ?? ""}\npayload:\n  summary: scripted ${key}\n${reason === undefined ? "" : `  reason: ${reason}\n`}`,
      }),
    );
  }
}
