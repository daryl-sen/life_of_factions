// pathfinding.js
import { GRID } from "./constants.js";
import { key, fromKey } from "./utils.js";

export function astar(start, goal, isBlocked) {
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
        nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && !isBlocked(nx, ny)
    );
  const sK = sk(start.x, start.y);
  g.set(sK, 0);
  f.set(sK, h(start.x, start.y));
  open.set(sK, [start.x, start.y]);

  while (open.size) {
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
