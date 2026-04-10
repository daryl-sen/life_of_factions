import { key, log } from '../../../core/utils';
import type { Organism } from '../../entity/organism';
import type { World } from '../../world/world';

// ── Constants ──
const CLEAN_INSPIRATION_GAIN = 10;

export function onPoopComplete(world: World, organism: Organism): void {
  world.blockManager.spawnPoop(organism.cellX, organism.cellY);
  log(world, 'hygiene', `${organism.name} pooped`, organism.id, { x: organism.cellX, y: organism.cellY });
}

export function onCleanComplete(world: World, organism: Organism): void {
  const act = organism.action!;
  const tp = act.payload?.targetPos;
  if (!tp) return;
  const k = key(tp.x, tp.y);
  if (world.grid.poopBlocks.has(k)) {
    world.grid.poopBlocks.delete(k);
    organism.needs.inspiration = Math.min(100, organism.needs.inspiration + CLEAN_INSPIRATION_GAIN);
    log(world, 'hygiene', `${organism.name} cleaned poop`, organism.id, { x: tp.x, y: tp.y });
  }
}
