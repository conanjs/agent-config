// Cycles and order of the dependency graph (AC-5.3, AC-5.4). An edge goes from a consumer to each provider it depends on.

/** The edges of the graph: component name to the names it depends on. */
export type Edges = ReadonlyMap<string, readonly string[]>;

// A cycle written from its smallest name, so the same cycle prints the same way whichever component the walk met first.
function rotated(cycle: readonly string[]): readonly string[] {
  const start = cycle.reduce((best, name, index) => (name < (cycle[best] ?? name) ? index : best), 0);
  return [...cycle.slice(start), ...cycle.slice(0, start)];
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
  const sorted = new Map([...edges].map(([name, targets]) => [name, [...targets].sort()]));
  const enterable = (name: string): boolean => !finished.has(name) && edges.has(name);
  for (const root of [...edges.keys()].sort().filter(enterable)) {
    if (finished.has(root)) continue;
    // An explicit stack, so a long chain cannot overflow the call stack; `position` finds a name on the path without a scan.
    const path: string[] = [root];
    const next: number[] = [0];
    const position = new Map<string, number>([[root, 0]]);
    while (path.length > 0) {
      const current = path[path.length - 1] ?? '';
      const index = next[next.length - 1] ?? 0;
      const target = sorted.get(current)?.[index];
      if (target === undefined) {
        finished.add(current);
        position.delete(current);
        path.pop();
        next.pop();
        continue;
      }
      next[next.length - 1] = index + 1;
      const at = position.get(target);
      if (at !== undefined) {
        const cycle = rotated(path.slice(at));
        found.set(cycle.join('\0'), cycle);
      } else if (enterable(target)) {
        position.set(target, path.length);
        path.push(target);
        next.push(0);
      }
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
