import { TICK_MS } from '../../core/constants';
import { key, log } from '../../core/utils';
import type { World } from '../world/world';

// ── Inlined TUNE constants ──

const WATER_BASE_DECAY_PER_TICK = 0.008;
const WATER_SHRINK_THRESHOLD = 0.25;

const TERRAIN_UPDATE_INTERVAL = 40; // ticks (~10 seconds)

export class WorldUpdater {

  // ── Water decay ──

  static tickWaterDecay(world: World): void {
    const toDelete: string[] = [];
    const seen = new Set<string>();
    for (const [k, wb] of world.waterBlocks) {
      if (seen.has(wb.id)) continue;
      seen.add(wb.id);
      wb.units -= WATER_BASE_DECAY_PER_TICK;
      if (wb.units <= 0) {
        for (const c of wb.cells) toDelete.push(key(c.x, c.y));
      } else if (wb.size === 'large' && wb.units < wb.maxUnits * WATER_SHRINK_THRESHOLD) {
        // Shrink large to small (keep first cell only)
        const keep = wb.cells[0];
        for (let i = 1; i < wb.cells.length; i++) {
          world.waterBlocks.delete(key(wb.cells[i].x, wb.cells[i].y));
        }
        wb.size = 'small' as const;
        wb.cells = [keep];
        wb.x = keep.x;
        wb.y = keep.y;
      }
    }
    for (const k of toDelete) world.waterBlocks.delete(k);
  }

  // ── Terrain moisture recompute ──

  static tickTerrain(world: World): void {
    if (world.tick % TERRAIN_UPDATE_INTERVAL === 0) {
      world.terrainField.recomputeAll(world.grid);
    }
  }

  // ── Tree aging ──

  static tickTreeAging(world: World): void {
    const toRemove: string[] = [];
    for (const [k, tree] of world.treeBlocks) {
      tree.ageTotalMs += TICK_MS;
      if (tree.ageTotalMs >= tree.maxAgeMs) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) {
      const tree = world.treeBlocks.get(k);
      world.treeBlocks.delete(k);
      if (tree) {
        world.deadMarkers.push({ cellX: tree.x, cellY: tree.y, cause: 'tree', msRemaining: 10000 });
        log(world, 'death', `Tree @${tree.x},${tree.y} died of old age`, null, { x: tree.x, y: tree.y });
      }
    }
  }

  // ── Block decay (delegates to BlockManager) ──

  static tickBlockDecay(world: World): void {
    world.blockManager.tickDecay();
  }

  // ── Combined update ──

  static update(world: World): void {
    WorldUpdater.tickWaterDecay(world);
    WorldUpdater.tickTerrain(world);
    WorldUpdater.tickTreeAging(world);
    WorldUpdater.tickBlockDecay(world);
  }
}
