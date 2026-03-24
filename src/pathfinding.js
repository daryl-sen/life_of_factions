import { GRID } from './constants.js';
import { key, fromKey, rndi } from './utils.js';
import { isBlocked } from './spatial.js';

export function astar(start, goal, isBlocked2) {
  const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
  const open = new Map(),
    came = new Map(),
    g = new Map(),
    f = new Map();
  const sk = (x, y) => key(x, y);
  const neighbors = (x, y) =>
    [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ].filter(
      ([nx, ny]) =>
        nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && !isBlocked2(nx, ny)
    );
  const sK = sk(start.x, start.y);
  g.set(sK, 0);
  f.set(sK, h(start.x, start.y));
  open.set(sK, [start.x, start.y]);
  let expansions = 0;
  const MAX_EXP = 900;
  while (open.size) {
    if (++expansions > MAX_EXP) return null;
    let currentKey = null,
      current = null,
      best = Infinity;
    for (const [k, xy] of open) {
      const fv = f.get(k) ?? Infinity;
      if (fv < best) {
        best = fv;
        currentKey = k;
        current = xy;
      }
    }
    if (!current) break;
    const [cx, cy] = current;
    if (cx === goal.x && cy === goal.y) {
      const path = [];
      let ck = currentKey;
      while (ck) {
        const { x, y } = fromKey(ck);
        path.push({ x, y });
        ck = came.get(ck);
      }
      return path.reverse();
    }
    open.delete(currentKey);
    for (const [nx, ny] of neighbors(cx, cy)) {
      const nk = sk(nx, ny),
        tentative = (g.get(currentKey) ?? Infinity) + 1;
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

export function planPathTo(world, a, gx, gy, force = false) {
  if (!force) {
    if (world._pathWhitelist && !world._pathWhitelist.has(a.id)) return;
    if (world.tick < (a.replanAtTick || 0)) return;
    if (world.pathBudget <= 0) return;
    world.pathBudget--;
  }
  a.goal = { x: gx, y: gy };
  const path = astar({ x: a.cellX, y: a.cellY }, { x: gx, y: gy }, (x, y) =>
    isBlocked(world, x, y, a.id)
  );
  a.path = path;
  a.pathIdx = 0;
  a.replanAtTick = world.tick + 6 + rndi(0, 6);
}

export function findNearest(world, a, coll) {
  let best = null,
    bestD = 1e9;
  for (const it of coll) {
    const d = Math.abs(a.cellX - it.x) + Math.abs(a.cellY - it.y);
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best ? { target: best, dist: bestD } : null;
}
