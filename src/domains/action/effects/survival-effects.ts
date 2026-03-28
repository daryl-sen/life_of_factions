import { log } from '../../../core/utils';
import type { Agent } from '../../entity/agent';
import type { World } from '../../world/world';

// ── Constants ──
const SLEEP_ENERGY_PER_TICK = 8;
const FULLNESS_CROP_GAIN = 20;
const HYGIENE_WASH_GAIN = 30;
const POOP_WINDOW_MS = 30000;
const XP_PER_EAT = 5;

// ── Sleep ──

export function onSleepTick(_world: World, agent: Agent): void {
  agent.addEnergy(SLEEP_ENERGY_PER_TICK);
}

export function onSleepComplete(world: World, agent: Agent): void {
  log(world, 'sleep', `${agent.name} woke up`, agent.id, {});
}

// ── Eat ──

export function onEatComplete(world: World, agent: Agent): void {
  const removed = agent.removeFromInventory('food', 1);
  if (removed <= 0) return;
  agent.addFullness(FULLNESS_CROP_GAIN);
  agent.addXp(XP_PER_EAT);
  agent.poopTimerMs = POOP_WINDOW_MS;
  log(world, 'eat', `${agent.name} ate food`, agent.id, {});
  checkLevelUp(world, agent);
}

// ── Wash (renamed from drink) ──

export function onWashComplete(world: World, agent: Agent): void {
  const removed = agent.removeFromInventory('water', 1);
  if (removed <= 0) return;
  agent.hygiene = Math.min(100, agent.hygiene + HYGIENE_WASH_GAIN);
  log(world, 'hygiene', `${agent.name} washed up`, agent.id, {});
}

function checkLevelUp(world: World, agent: Agent): void {
  while (agent.canLevelUp()) {
    agent.levelUp();
    log(world, 'level', `${agent.name} leveled to ${agent.level}`, agent.id, {});
  }
}
