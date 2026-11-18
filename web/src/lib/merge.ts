interface Identified {
  id: string;
  timestamp: string;
}

function timeOf(iso: string): number {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Merge records by id, newest first, capped to `limit`.
 * Incoming entries win on id collisions.
 */
export function mergeById<T extends Identified>(
  incoming: readonly T[],
  current: readonly T[],
  limit: number,
): T[] {
  const byId = new Map<string, T>();
  for (const item of incoming) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  for (const item of current) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => timeOf(b.timestamp) - timeOf(a.timestamp)).slice(0, limit);
}
