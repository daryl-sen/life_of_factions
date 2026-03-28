import { key, log } from '../../../core/utils';
import type { Agent } from '../../entity/agent';
import type { World } from '../../world/world';

// ── Constants ──
const POOP_HYGIENE_DECAY = 5;
const CLEAN_INSPIRATION_GAIN = 10;

export function onPoopComplete(world: World, agent: Agent): void {
  world.blockManager.spawnPoop(world, agent.cellX, agent.cellY);
  agent.hygiene = Math.max(0, agent.hygiene - POOP_HYGIENE_DECAY);
  log(world, 'hygiene', `${agent.name} pooped`, agent.id, { x: agent.cellX, y: agent.cellY });
}

export function onCleanComplete(world: World, agent: Agent): void {
  const act = agent.action!;
  const tp = act.payload?.targetPos;
  if (!tp) return;
  const k = key(tp.x, tp.y);
  if (world.grid.poopBlocks.has(k)) {
    world.grid.poopBlocks.delete(k);
    agent.inspiration = Math.min(100, agent.inspiration + CLEAN_INSPIRATION_GAIN);
    log(world, 'hygiene', `${agent.name} cleaned poop`, agent.id, { x: tp.x, y: tp.y });
  }
}
