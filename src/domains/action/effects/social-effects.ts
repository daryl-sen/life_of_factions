import { log } from '../../../core/utils';
import type { IInventory, ResourceMemoryType } from '../../../core/types';
import type { Agent } from '../../entity/agent';
import type { World } from '../../world/world';
import { FactionManager } from '../../faction/faction-manager';

// ── Constants (was TUNE) ──
const HYGIENE_SOCIAL_DECAY = 0.5;
const MEMORY_SHARE_REL_THRESHOLD = 0.5;
const XP_PER_HEAL = 10;
const XP_PER_SHARE = 5;
const SHARE_SOCIAL_SHARER = 8;
const SHARE_SOCIAL_RECIPIENT = 5;
const SHARE_RELATIONSHIP_GAIN = 0.14;
const FACTION_FORM_REL_THRESHOLD = 0.6;
const SHARE_CONVERT_CHANCE = 0.5;
const SHARE_CONVERT_REL_THRESHOLD = 0.4;

// ── Talk ──

export function onTalkTick(world: World, agent: Agent, target: Agent): void {
  const delta =
    (Math.random() < 0.75 ? 0.14 : -0.06) *
    (agent.factionId === target.factionId ? 1.1 : 0.8);
  agent.relationships.adjust(target.id, delta);
  target.relationships.adjust(agent.id, delta);
  log(world, 'talk', `${agent.name} talked with ${target.name}`, agent.id, { to: target.id, delta });
}

export function onTalkComplete(world: World, agent: Agent, target: Agent): void {
  applySocialHygieneDecay(agent, target);
  maybeFormFaction(world, agent, target);
  shareResourceMemories(agent, target, world.tick);
}

// ── Quarrel ──

export function onQuarrelTick(world: World, agent: Agent, target: Agent): void {
  const delta =
    (Math.random() < 0.5 ? -0.1 : 0.1) *
    (agent.factionId === target.factionId ? 0.6 : 1);
  agent.relationships.adjust(target.id, delta);
  target.relationships.adjust(agent.id, delta);
  log(world, 'quarrel', `${agent.name} ${delta > 0 ? 'made peace with' : 'argued with'} ${target.name}`, agent.id, { to: target.id, delta });
}

export function onQuarrelComplete(_world: World, agent: Agent, target: Agent): void {
  applySocialHygieneDecay(agent, target);
}

// ── Heal ──

export function onHealTick(world: World, agent: Agent, target: Agent): void {
  target.healBy(2);
  agent.drainFullness(0.5);
  log(world, 'heal', `${agent.name} healed ${target.name}`, agent.id, { to: target.id });
}

export function onHealComplete(world: World, agent: Agent, target: Agent): void {
  agent.addXp(XP_PER_HEAL);
  if (target.diseased) {
    target.diseased = false;
    log(world, 'hygiene', `${agent.name} cured ${target.name}'s disease`, agent.id, { to: target.id });
  }
  applySocialHygieneDecay(agent, target);
  checkLevelUp(world, agent);
  maybeFormFaction(world, agent, target);
}

// ── Share ──

export function onShareTick(world: World, agent: Agent, target: Agent): void {
  const rt = pickShareResource(agent, target);
  if (rt && agent.inventory[rt] > 0 && !target.inventoryFull()) {
    agent.removeFromInventory(rt, 1);
    target.addToInventory(rt, 1);
    log(world, 'share', `${agent.name} gave 1 ${rt} to ${target.name}`, agent.id, { to: target.id, resource: rt });
  }
}

export function onShareComplete(world: World, agent: Agent, target: Agent): void {
  agent.addXp(XP_PER_SHARE);
  agent.social = Math.min(100, agent.social + SHARE_SOCIAL_SHARER);
  target.social = Math.min(100, target.social + SHARE_SOCIAL_RECIPIENT);
  agent.relationships.adjust(target.id, SHARE_RELATIONSHIP_GAIN);
  target.relationships.adjust(agent.id, SHARE_RELATIONSHIP_GAIN);
  applySocialHygieneDecay(agent, target);
  checkLevelUp(world, agent);
  maybeFormFaction(world, agent, target);
  shareResourceMemories(agent, target, world.tick);

  // Faction recruitment via share
  if (agent.factionId) {
    if (
      Math.random() < SHARE_CONVERT_CHANCE &&
      agent.relationships.get(target.id) >= SHARE_CONVERT_REL_THRESHOLD &&
      target.factionId !== agent.factionId
    ) {
      FactionManager.setFaction(world, target, agent.factionId, 'recruitment');
    }
  }
}

// ── Helpers ──

function applySocialHygieneDecay(agent: Agent, target: Agent): void {
  agent.hygiene = Math.max(0, agent.hygiene - HYGIENE_SOCIAL_DECAY);
  target.hygiene = Math.max(0, target.hygiene - HYGIENE_SOCIAL_DECAY);
}

function maybeFormFaction(world: World, agent: Agent, target: Agent): void {
  if (!agent.factionId && !target.factionId) {
    const rel = agent.relationships.get(target.id);
    if (rel >= FACTION_FORM_REL_THRESHOLD) {
      FactionManager.create(world, [agent, target]);
    }
  }
}

function pickShareResource(agent: Agent, target: Agent): keyof IInventory | null {
  if (agent.inventoryTotal() <= 0) return null;
  if (target.fullness < 40 && agent.inventory.food > 0) return 'food';
  if (target.hygiene < 40 && agent.inventory.water > 0) return 'water';
  const { food, water, wood } = agent.inventory;
  if (food >= water && food >= wood && food > 0) return 'food';
  if (water >= food && water >= wood && water > 0) return 'water';
  if (wood > 0) return 'wood';
  return null;
}

/**
 * If the two agents have a strong enough relationship, exchange resource memories.
 * Snapshots are taken before writing so neither agent's entries are mutated mid-iteration.
 * Shared entries use the current tick so they are treated as freshly discovered —
 * rememberResource will evict the oldest entry when a slot limit is reached.
 */
function shareResourceMemories(agent: Agent, target: Agent, currentTick: number): void {
  const rel = agent.relationships.get(target.id);
  if (rel < MEMORY_SHARE_REL_THRESHOLD) return;

  const types: ResourceMemoryType[] = ['food', 'water', 'wood'];
  for (const type of types) {
    const agentEntries = [...agent.resourceMemory.get(type)!];
    const targetEntries = [...target.resourceMemory.get(type)!];

    for (const e of agentEntries) {
      target.rememberResource(type, e.x, e.y, currentTick);
    }
    for (const e of targetEntries) {
      agent.rememberResource(type, e.x, e.y, currentTick);
    }
  }
}

function checkLevelUp(world: World, agent: Agent): void {
  while (agent.canLevelUp()) {
    agent.levelUp();
    log(world, 'level', `${agent.name} leveled to ${agent.level}`, agent.id, {});
  }
}
