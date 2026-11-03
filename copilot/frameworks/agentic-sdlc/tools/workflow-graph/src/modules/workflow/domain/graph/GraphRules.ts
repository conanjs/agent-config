import type { Finding } from "./Finding.ts";
import type { EdgeData, GraphData } from "./GraphData.ts";

/** The structural rules of a graph whose shape is valid: edges, reachability, branching, gates, budgets, loops, paths (WG-3 … WG-12, not WG-8). */
export class GraphRules {
  readonly #graph: GraphData;
  readonly #where: string;

  /**
   * Prepares the structural checks for one graph whose shape already passed.
   *
   * @param graph - graph data that already passed the shape check (WG-1, WG-2)
   * @param where - file name used in findings
   */
  public constructor(graph: GraphData, where: string) {
    this.#graph = graph;
    this.#where = where;
  }

  /**
   * Returns every structural finding, in rule order; empty when the graph is sound.
   *
   * @returns every structural finding, in rule order; empty when the graph is sound
   */
  public check(): Finding[] {
    const dangling = this.#danglingEdges();
    if (dangling.length > 0) return dangling;
    return [
      ...this.#unreachable(),
      ...this.#cannotFinish(),
      ...this.#branching(),
      ...this.#gates(),
      ...this.#phaseGates(),
      ...this.#budgets(),
      ...this.#loops(),
      ...this.#paths(),
    ];
  }

  #f(code: string, message: string): Finding {
    return { code, where: this.#where, message };
  }

  #out(id: string): EdgeData[] {
    return this.#graph.edges.filter((e) => e.from === id);
  }

  #danglingEdges(): Finding[] {
    const nodes = this.#graph.nodes;
    return this.#graph.edges.flatMap((e) =>
      [e.from, e.to]
        .filter((n) => !(n in nodes))
        .map((n) => this.#f("WG-3", `edge ${e.from} → ${e.to}: "${n}" is not a node`)),
    );
  }

  #reach(from: readonly string[], step: (id: string) => string[]): Set<string> {
    const seen = new Set(from);
    const queue = [...from];
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      for (const next of step(id)) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return seen;
  }

  #unreachable(): Finding[] {
    const seen = this.#reach([this.#graph.start], (id) => this.#out(id).map((e) => e.to));
    return Object.keys(this.#graph.nodes)
      .filter((id) => !seen.has(id))
      .map((id) => this.#f("WG-4", `node "${id}" cannot be reached from ${this.#graph.start}`));
  }

  #cannotFinish(): Finding[] {
    const ends = Object.keys(this.#graph.nodes).filter(
      (id) => this.#graph.nodes[id]?.kind === "end",
    );
    const finishes = this.#reach(ends, (id) =>
      this.#graph.edges.filter((e) => e.to === id).map((e) => e.from),
    );
    return Object.keys(this.#graph.nodes)
      .filter((id) => !finishes.has(id))
      .map((id) => this.#f("WG-5", `node "${id}" never reaches an end node`));
  }

  #branching(): Finding[] {
    return Object.keys(this.#graph.nodes).flatMap((id) => {
      const out = this.#out(id);
      const otherwise = out.filter((e) => e.on === "otherwise").length;
      if (out.length < 2 || otherwise === 1) return [];
      return [
        this.#f(
          "WG-6",
          otherwise === 0
            ? `node "${id}" branches but has no "otherwise" edge`
            : `node "${id}" has ${otherwise} "otherwise" edges`,
        ),
      ];
    });
  }

  #gates(): Finding[] {
    const gates = Object.keys(this.#graph.nodes).filter(
      (id) => this.#graph.nodes[id]?.kind === "gate",
    );
    return gates.flatMap((id) => {
      const out = this.#out(id);
      const approved = out.filter((e) => e.on === "approved");
      const found: Finding[] = [];
      if (approved.length === 0) found.push(this.#f("WG-7", `gate "${id}" has no "approved" edge`));
      if (!out.some((e) => e.on === "changes-requested"))
        found.push(this.#f("WG-7", `gate "${id}" has no "changes-requested" edge`));
      return [...found, ...this.#overlaps(id, approved)];
    });
  }

  #overlaps(gate: string, approved: readonly EdgeData[]): Finding[] {
    const all = this.#graph.paths.map((p) => p.id);
    const counts = new Map<string, number>();
    for (const e of approved)
      for (const p of e.paths ?? all) counts.set(p, (counts.get(p) ?? 0) + 1);
    return [...counts]
      .filter(([, n]) => n > 1)
      .map(([p]) => this.#f("WG-7", `gate "${gate}": approved edges overlap on path "${p}"`));
  }

  #phaseGates(): Finding[] {
    return Object.entries(this.#graph.nodes)
      .filter(
        ([, n]) =>
          n.kind === "phase" && n.gate !== undefined && this.#graph.nodes[n.gate]?.kind !== "gate",
      )
      .map(([id, n]) =>
        this.#f("WG-9", `phase "${id}": gate "${String(n.gate)}" is not a gate node`),
      );
  }

  #budgets(): Finding[] {
    const bad = Object.entries(this.#graph.budgets)
      .filter(([, b]) => !Number.isInteger(b.default) || b.default < 0)
      .map(([name, b]) =>
        this.#f(
          "WG-10",
          `budget "${name}": default ${String(b.default)} is not a whole number ≥ 0`,
        ),
      );
    const unknown = this.#graph.edges
      .filter((e) => e.budget !== undefined && !(e.budget in this.#graph.budgets))
      .map((e) =>
        this.#f(
          "WG-10",
          `edge ${e.from} → ${e.to}: budget "${String(e.budget)}" is not in budgets`,
        ),
      );
    return [...bad, ...unknown];
  }

  /**
   * Depth-first search over unbudgeted edges between non-gate nodes; an edge back to a node on the stack closes a loop no budget bounds.
   *
   * @returns one WG-11 finding per edge that closes such a loop
   */
  #loops(): Finding[] {
    const isGate = (id: string): boolean => this.#graph.nodes[id]?.kind === "gate";
    const free = (id: string): EdgeData[] =>
      isGate(id) ? [] : this.#out(id).filter((e) => e.budget === undefined && !isGate(e.to));
    const state = new Map<string, "open" | "done">();
    const found: Finding[] = [];
    const visit = (id: string): void => {
      state.set(id, "open");
      for (const e of free(id)) {
        if (state.get(e.to) === "open")
          found.push(
            this.#f(
              "WG-11",
              `edge ${e.from} → ${e.to} closes a loop with no gate and has no budget`,
            ),
          );
        else if (!state.has(e.to)) visit(e.to);
      }
      state.set(id, "done");
    };
    for (const id of [this.#graph.start, ...Object.keys(this.#graph.nodes)])
      if (!state.has(id)) visit(id);
    return found;
  }

  #paths(): Finding[] {
    return this.#graph.paths.flatMap((path) => {
      const found: Finding[] = [];
      let previous = this.#graph.start;
      for (const phase of path.run) {
        if (!this.#nextPhases(previous, path.id).has(phase)) {
          found.push(this.#f("WG-12", `path "${path.id}": ${phase} does not follow ${previous}`));
          break;
        }
        previous = phase;
      }
      return found;
    });
  }

  /**
   * Phases reachable from `from` through gates and steps only, along edges valid for the path.
   *
   * @param from - the phase the walk starts at
   * @param path - the path id whose edges count
   * @returns the phase ids reached first on each branch
   */
  #nextPhases(from: string, path: string): Set<string> {
    const allowed = (e: EdgeData): boolean =>
      (e.from !== this.#graph.start || e.on === path) &&
      (e.paths === undefined || e.paths.includes(path));
    const phases = new Set<string>();
    this.#reach([from], (id) => {
      if (id !== from && this.#graph.nodes[id]?.kind === "phase") return (phases.add(id), []);
      return this.#out(id)
        .filter(allowed)
        .map((e) => e.to);
    });
    return phases;
  }
}
