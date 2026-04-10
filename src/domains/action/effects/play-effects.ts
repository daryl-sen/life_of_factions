import { key, log } from '../../../core/utils';
import type { Organism } from '../../entity/organism';
import type { World } from '../../world/world';

const PLAY_INSPIRATION_GAIN = 15;
const PLAY_POOP_HYGIENE_PENALTY = 3;

export function onPlayComplete(world: World, organism: Organism): void {
  organism.needs.inspiration = Math.min(100, organism.needs.inspiration + PLAY_INSPIRATION_GAIN);

  // Check if poop nearby — reduces hygiene
  const adj: [number, number][] = [
    [organism.cellX, organism.cellY],
    [organism.cellX + 1, organism.cellY], [organism.cellX - 1, organism.cellY],
    [organism.cellX, organism.cellY + 1], [organism.cellX, organism.cellY - 1],
  ];
  let nearPoop = false;
  for (const [nx, ny] of adj) {
    if (world.grid.poopBlocks.has(key(nx, ny))) { nearPoop = true; break; }
  }
  if (nearPoop && organism.hasHygiene) {
    organism.needs.hygiene = Math.max(0, organism.needs.hygiene - PLAY_POOP_HYGIENE_PENALTY);
  }
  log(world, 'info', `${organism.name} played${nearPoop ? ' (near poop!)' : ''}`, organism.id, {});
}
