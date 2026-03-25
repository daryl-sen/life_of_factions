import { GRID } from './constants';
import { key, fromKey, rndi } from './utils';
import type { IPosition } from './types';
import type { World } from '../domains/world';

export class Pathfinder {
  private static readonly MAX_EXP = 900;

  static astar(
    start: IPosition,
    goal: IPosition,
    isBlocked: (x: number, y: number) => boolean
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
          nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && !isBlocked(nx, ny)
      );

    const sK = sk(start.x, start.y);
    g.set(sK, 0);
    f.set(sK, h(start.x, start.y));
    open.set(sK, [start.x, start.y]);
    let expansions = 0;

    while (open.size) {
      if (++expansions > Pathfinder.MAX_EXP) return null;
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

  static planPathTo(
    world: World,
    a: { id: string; cellX: number; cellY: number; path: IPosition[] | null; pathIdx: number; replanAtTick: number; goal: IPosition | null },
    gx: number,
    gy: number,
    force = false
  ): void {
    if (!force) {
      if (world._pathWhitelist && !world._pathWhitelist.has(a.id)) return;
      if (world.tick < (a.replanAtTick || 0)) return;
      if (world.pathBudget <= 0) return;
      world.pathBudget--;
    }
    a.goal = { x: gx, y: gy };
    const path = Pathfinder.astar(
      { x: a.cellX, y: a.cellY },
      { x: gx, y: gy },
      (x, y) => world.grid.isBlocked(x, y, a.id)
    );
    a.path = path;
    a.pathIdx = 0;
    a.replanAtTick = world.tick + 1 + rndi(0, 1);
  }

  static findNearest(
    a: { cellX: number; cellY: number },
    coll: Iterable<{ x: number; y: number }>
  ): { target: { x: number; y: number }; dist: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = 1e9;
    for (const it of coll) {
      const d = Math.abs(a.cellX - it.x) + Math.abs(a.cellY - it.y);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best ? { target: best, dist: bestD } : null;
  }
}
