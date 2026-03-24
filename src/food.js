import { GRID } from './constants.js';
import { key } from './utils.js';
import { isBlocked } from './spatial.js';
import { harvestAt } from './harvest.js';
import { planPathTo, findNearest } from './pathfinding.js';

const FF_INF = 0xffff;
const ffIdx = (x, y) => y * GRID + x;

export function recomputeFoodField(world) {
  const N = GRID * GRID;
  if (!world.foodField || world.foodField.length !== N)
    world.foodField = new Uint16Array(N);
  world.foodField.fill(FF_INF);
  if (world.crops.size === 0) {
    world._foodFieldTick = world.tick;
    return;
  }
  const staticBlocked = (x, y) => {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
    const k = key(x, y);
    if (world.walls.has(k)) return true;
    if (world.farms.has(k)) return true;
    if (world.flagCells.has(k)) return true;
    return false;
  };
  const qx = new Int16Array(N),
    qy = new Int16Array(N);
  let head = 0,
    tail = 0;
  for (const c of world.crops.values()) {
    const i = ffIdx(c.x, c.y);
    world.foodField[i] = 0;
    qx[tail] = c.x;
    qy[tail] = c.y;
    tail++;
  }
  while (head < tail) {
    const x = qx[head],
      y = qy[head];
    head++;
    const d0 = world.foodField[ffIdx(x, y)];
    const nbrs = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of nbrs) {
      if (staticBlocked(nx, ny)) continue;
      const ii = ffIdx(nx, ny);
      if (world.foodField[ii] > d0 + 1) {
        world.foodField[ii] = d0 + 1;
        qx[tail] = nx;
        qy[tail] = ny;
        tail++;
      }
    }
  }
  world._foodFieldTick = world.tick;
}

export function stepTowardFood(world, a) {
  const here = world.foodField[ffIdx(a.cellX, a.cellY)];
  if (here === FF_INF) return false;
  let best = { d: here, x: a.cellX, y: a.cellY };
  const adj = [
    [a.cellX + 1, a.cellY],
    [a.cellX - 1, a.cellY],
    [a.cellX, a.cellY + 1],
    [a.cellX, a.cellY - 1],
  ];
  for (const [nx, ny] of adj) {
    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
    if (isBlocked(world, nx, ny, a.id)) continue;
    const d = world.foodField[ffIdx(nx, ny)];
    if (d < best.d) best = { d, x: nx, y: ny };
  }
  if (best.x === a.cellX && best.y === a.cellY) return false;
  a.path = [{ x: best.x, y: best.y }];
  a.pathIdx = 0;
  a.goal = null;
  return true;
}

export function seekFoodWhenHungry(world, a) {
  if (world.crops.has(key(a.cellX, a.cellY))) {
    harvestAt(world, a, a.cellX, a.cellY);
    return;
  }
  if (world.tick - (world._foodFieldTick || 0) >= 5) {
    recomputeFoodField(world);
  }
  const adj = [
    [a.cellX + 1, a.cellY],
    [a.cellX - 1, a.cellY],
    [a.cellX, a.cellY + 1],
    [a.cellX, a.cellY - 1],
  ];
  for (const [nx, ny] of adj) {
    const k = key(nx, ny);
    if (world.crops.has(k) && !world.flagCells.has(k)) {
      a.path = [{ x: nx, y: ny }];
      a.pathIdx = 0;
      a.goal = null;
      return;
    }
  }
  const scarcity = world.crops.size / Math.max(1, world.agents.length);
  if (scarcity < 0.35) {
    if (stepTowardFood(world, a)) return;
  }
  const filtered = [...world.crops.values()].filter(
    (c) => !world.flagCells.has(key(c.x, c.y))
  );
  if (filtered.length) {
    const near = findNearest(world, a, filtered);
    if (near) {
      planPathTo(world, a, near.target.x, near.target.y);
      return;
    }
  }
}
