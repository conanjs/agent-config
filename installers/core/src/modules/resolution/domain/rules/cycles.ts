// Cycles and order of the dependency graph (AC-5.3, AC-5.4). An edge goes from a consumer to each provider it depends on.

/** The edges of the graph: component name to the names it depends on. */
export type Edges = ReadonlyMap<string, readonly string[]>;

// A cycle written from its smallest name, so the same cycle prints the same way whichever component the walk met first.
function rotated(cycle: readonly string[]): readonly string[] {
  const start = cycle.reduce((best, name, index) => (name < (cycle[best] ?? name) ? index : best), 0);
  return [...cycle.slice(start), ...cycle.slice(0, start)];
}

interface Walk {
  /** The names from the start of the walk to the current one. */
  readonly path: readonly string[];
  /** For each name of the path, the index of the next target to follow. */
  readonly next: readonly number[];
}

interface Step {
  readonly walk: Walk;
  readonly cycle: readonly string[] | undefined;
}

// Moves the walk one step: down to the next unfinished target, or back up when the current name has none left. The step carries
// the cycle when it meets a name that is already on the path. Nothing is changed in place.
function step(edges: Edges, walk: Walk, finished: ReadonlySet<string>): Step & { readonly done: string | undefined } {
  const current = walk.path[walk.path.length - 1] ?? '';
  const targets = [...(edges.get(current) ?? [])].sort();
  const index = walk.next[walk.next.length - 1] ?? 0;
  if (index >= targets.length) {
    return { walk: { path: walk.path.slice(0, -1), next: walk.next.slice(0, -1) }, cycle: undefined, done: current };
  }
  const advanced = { path: walk.path, next: [...walk.next.slice(0, -1), index + 1] };
  const target = targets[index] ?? '';
  const at = walk.path.indexOf(target);
  if (at !== -1) return { walk: advanced, cycle: rotated(walk.path.slice(at)), done: undefined };
  const enter = !finished.has(target) && edges.has(target);
  return {
    walk: enter ? { path: [...advanced.path, target], next: [...advanced.next, 0] } : advanced,
    cycle: undefined,
    done: undefined,
  };
}

/**
 * Finds the cycles of the graph by a depth-first walk that starts from each name in order and follows each edge in order; every
 * back edge it meets is one cycle. Cycles that share no back edge are all found; a graph with many overlapping cycles may print
 * fewer cycles than it holds, but never none when it holds one.
 *
 * @param edges - the dependency edges
 * @returns each cycle once, from its smallest name, sorted; `a -> b -> a` is `['a', 'b']` (a self-cycle is `['a']`)
 */
export function findCycles(edges: Edges): readonly (readonly string[])[] {
  const found = new Map<string, readonly string[]>();
  const finished = new Set<string>();
  for (const root of [...edges.keys()].sort()) {
    // An explicit stack, so a long chain cannot overflow the call stack.
    let walk: Walk = { path: finished.has(root) ? [] : [root], next: [0] };
    while (walk.path.length > 0) {
      const moved = step(edges, walk, finished);
      walk = moved.walk;
      if (moved.done !== undefined) finished.add(moved.done);
      if (moved.cycle !== undefined) found.set(moved.cycle.join('\0'), moved.cycle);
    }
  }
  return [...found.entries()].sort(([left], [right]) => (left < right ? -1 : 1)).map(([, cycle]) => cycle);
}

/**
 * Orders the components so that every provider comes before its consumers; ties go in name order.
 *
 * @param edges - the dependency edges of a graph without cycles
 * @returns every name once, providers first
 */
export function providersFirst(edges: Edges): readonly string[] {
  const pending = new Map(
    [...edges].map(([name, targets]) => [name, new Set(targets.filter((each) => edges.has(each) && each !== name))]),
  );
  const order: string[] = [];
  while (pending.size > 0) {
    const ready = [...pending]
      .filter(([, waiting]) => waiting.size === 0)
      .map(([name]) => name)
      .sort();
    const [name] = ready;
    // No name is ready only when a cycle is left, which the caller has already refused; stop instead of looping.
    if (name === undefined) return [...order, ...[...pending.keys()].sort()];
    order.push(name);
    pending.delete(name);
    for (const waiting of pending.values()) waiting.delete(name);
  }
  return order;
}
