import type { IPosition } from './types';
import { key, fromKey, rndi } from './utils';

export interface IGridQuery {
  isBlocked(x: number, y: number): boolean;
  isOccupied(x: number, y: number): boolean;
  width: number;
  height: number;
}

const MAX_EXPANSIONS = 900;

export function findPath(
  grid: IGridQuery,
  start: IPosition,
  goal: IPosition,
  maxSteps: number = MAX_EXPANSIONS
): IPosition[] | null {
  const h = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
  const open = new Map<string, [number, number]>();
  const came = new Map<string, string>();
  const g = new Map<string, number>();
  const f = new Map<string, number>();
  const sk = (x: number, y: number) => key(x, y);
  const neighbors = (x: number, y: number): [number, number][] =>
    (
      [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as [number, number][]
    ).filter(
      ([nx, ny]) =>
        nx >= 0 && ny >= 0 && nx < grid.width && ny < grid.height && !grid.isBlocked(nx, ny)
    );

  const sK = sk(start.x, start.y);
  g.set(sK, 0);
  f.set(sK, h(start.x, start.y));
  open.set(sK, [start.x, start.y]);
  let expansions = 0;

  while (open.size) {
    if (++expansions > maxSteps) return null;
    let currentKey: string | null = null;
    let current: [number, number] | null = null;
    let best = Infinity;
    for (const [k, xy] of open) {
      const fv = f.get(k) ?? Infinity;
      if (fv < best) {
        best = fv;
        currentKey = k;
        current = xy;
      }
    }
    if (!current || !currentKey) break;
    const [cx, cy] = current;
    if (cx === goal.x && cy === goal.y) {
      const path: IPosition[] = [];
      let ck: string | undefined = currentKey;
      while (ck) {
        const { x, y } = fromKey(ck);
        path.push({ x, y });
        ck = came.get(ck);
      }
      return path.reverse();
    }
    open.delete(currentKey);
    for (const [nx, ny] of neighbors(cx, cy)) {
      const nk = sk(nx, ny);
      const tentative = (g.get(currentKey) ?? Infinity) + 1;
      if (tentative < (g.get(nk) ?? Infinity)) {
        came.set(nk, currentKey);
        g.set(nk, tentative);
        f.set(nk, tentative + h(nx, ny));
        if (!open.has(nk)) open.set(nk, [nx, ny]);
      }
    }
  }
  return null;
}

export function findNearest(
  pos: { x: number; y: number },
  coll: Iterable<{ x: number; y: number }>
): { target: { x: number; y: number }; dist: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = 1e9;
  for (const it of coll) {
    const d = Math.abs(pos.x - it.x) + Math.abs(pos.y - it.y);
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best ? { target: best, dist: bestD } : null;
}

/**
 * Budget-aware path planning. Checks whitelist, tick replan, and budget before computing.
 * Mutates agent path fields directly.
 */
export function planPath(
  grid: IGridQuery,
  agent: {
    id: string;
    cellX: number;
    cellY: number;
    path: IPosition[] | null;
    pathIdx: number;
    replanAtTick: number;
    goal: IPosition | null;
  },
  gx: number,
  gy: number,
  tick: number,
  budget: { remaining: number },
  whitelist: Set<string> | null,
  force = false
): void {
  if (!force) {
    if (whitelist && !whitelist.has(agent.id)) return;
    if (tick < (agent.replanAtTick || 0)) return;
    if (budget.remaining <= 0) return;
    budget.remaining--;
  }
  agent.goal = { x: gx, y: gy };
  const path = findPath(grid, { x: agent.cellX, y: agent.cellY }, { x: gx, y: gy });
  agent.path = path;
  agent.pathIdx = 0;
  agent.replanAtTick = tick + 1 + rndi(0, 1);
}
