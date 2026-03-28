import { key, log } from '../../../core/utils';
import type { Agent } from '../../entity/agent';
import type { World } from '../../world/world';

const PLAY_INSPIRATION_GAIN = 15;
const PLAY_POOP_HYGIENE_PENALTY = 3;

export function onPlayComplete(world: World, agent: Agent): void {
  agent.inspiration = Math.min(100, agent.inspiration + PLAY_INSPIRATION_GAIN);

  // Check if poop nearby
  const adj: [number, number][] = [
    [agent.cellX, agent.cellY],
    [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
    [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
  ];
  let nearPoop = false;
  for (const [nx, ny] of adj) {
    if (world.grid.poopBlocks.has(key(nx, ny))) { nearPoop = true; break; }
  }
  if (nearPoop) {
    agent.hygiene = Math.max(0, agent.hygiene - PLAY_POOP_HYGIENE_PENALTY);
  }
  log(world, 'info', `${agent.name} played${nearPoop ? ' (near poop!)' : ''}`, agent.id, {});
}
