const LINE = /^- \[[ xX]\]\s+(T\d{3,})\b(.*)$/;
const TAGS: Readonly<Record<string, string>> = {
  Eng: "engineering",
  QA: "qa",
  DevOps: "devops",
  Arch: "architecture",
  SysArch: "system-architecture",
  Sec: "security",
  Spec: "product-spec",
  Stack: "tech-stack",
  Coord: "coordinator",
};

/** One task of `tasks.md`: its id, the role that owns it (from its department tag) and what it requires first. */
export type TaskEntry = {
  /** Task id, such as T001. */
  readonly id: string;
  /** Role owning the task, from its department tag; engineering when it has none. */
  readonly role: string;
  /** Task ids that must pass review first; empty when none. */
  readonly requires: readonly string[];
};

/** The tasks of a feature in file order; P6 runs them one at a time, each only after the tasks it requires (specs/020 US3.1). */
export class TaskList {
  readonly #tasks: readonly TaskEntry[];

  private constructor(tasks: readonly TaskEntry[]) {
    this.#tasks = tasks;
  }

  /**
   * Returns the tasks it lists.
   *
   * @param text - the whole tasks.md
   * @returns the tasks it lists
   */
  public static read(text: string): TaskList {
    const lines = text.split("\n");
    const tasks = lines.flatMap((line, i) => {
      const m = LINE.exec(line);
      if (m === null) return [];
      const tag = [...String(m[2]).matchAll(/\[([A-Za-z]+)\]/g)]
        .map((t) => String(t[1]))
        .reverse()
        .find((t) => t in TAGS);
      const req = /requires:\s*([^·]+)/.exec(lines[i + 1] ?? "")?.[1]?.trim() ?? "none";
      return [
        {
          id: String(m[1]),
          role: TAGS[tag ?? "Eng"] ?? "engineering",
          requires: req === "none" ? [] : req.split(",").map((t) => t.trim()),
        },
      ];
    });
    return new TaskList(tasks);
  }

  /**
   * Returns the first task not passed whose required tasks all passed.
   *
   * @param passed - ids of tasks whose review passed
   * @returns the first task not passed whose required tasks all passed
   */
  public nextReady(passed: ReadonlySet<string>): TaskEntry | undefined {
    return this.#tasks.find((t) => !passed.has(t.id) && t.requires.every((r) => passed.has(r)));
  }

  /**
   * Returns the task, when listed.
   *
   * @param id - a task id
   * @returns the task, when listed
   */
  public find(id: string): TaskEntry | undefined {
    return this.#tasks.find((t) => t.id === id);
  }
}
