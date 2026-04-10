import { log } from '../../../core/utils';
import type { ResourceType, ResourceMemoryType } from '../../../core/types';
import type { Organism } from '../../entity/organism';
import type { World } from '../../world/world';
import { FactionManager } from '../../faction/faction-manager';

// ── Constants ──
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

export function onTalkTick(world: World, organism: Organism, target: Organism): void {
  const delta =
    (Math.random() < 0.75 ? 0.14 : -0.06) *
    (organism.factionId === target.factionId ? 1.1 : 0.8);
  organism.relationships.adjust(target.id, delta);
  target.relationships.adjust(organism.id, delta);
  log(world, 'talk', `${organism.name} talked with ${target.name}`, organism.id, { to: target.id, delta });
}

export function onTalkComplete(world: World, organism: Organism, target: Organism): void {
  applySocialHygieneDecay(organism, target);
  maybeFormFaction(world, organism, target);
  shareResourceMemories(organism, target, world.tick);
}

// ── Quarrel ──

export function onQuarrelTick(world: World, organism: Organism, target: Organism): void {
  const delta =
    (Math.random() < 0.5 ? -0.1 : 0.1) *
    (organism.factionId === target.factionId ? 0.6 : 1);
  organism.relationships.adjust(target.id, delta);
  target.relationships.adjust(organism.id, delta);
  log(world, 'quarrel', `${organism.name} ${delta > 0 ? 'made peace with' : 'argued with'} ${target.name}`, organism.id, { to: target.id, delta });
}

export function onQuarrelComplete(_world: World, organism: Organism, target: Organism): void {
  applySocialHygieneDecay(organism, target);
}

// ── Heal ──

export function onHealTick(world: World, organism: Organism, target: Organism): void {
  target.healBy(2);
  organism.drainFullness(0.5);
  log(world, 'heal', `${organism.name} healed ${target.name}`, organism.id, { to: target.id });
}

export function onHealComplete(world: World, organism: Organism, target: Organism): void {
  organism.addXp(XP_PER_HEAL);
  if (target.diseased) {
    target.diseased = false;
    log(world, 'hygiene', `${organism.name} cured ${target.name}'s disease`, organism.id, { to: target.id });
  }
  applySocialHygieneDecay(organism, target);
  checkLevelUp(world, organism);
  maybeFormFaction(world, organism, target);
}

// ── Share ──

export function onShareTick(world: World, organism: Organism, target: Organism): void {
  const rt = pickShareResource(organism, target);
  if (rt && organism.inventory[rt] > 0 && !target.inventory.isFull()) {
    organism.inventory.remove(rt, 1);
    target.inventory.add(rt, 1);
    log(world, 'share', `${organism.name} gave 1 ${rt} to ${target.name}`, organism.id, { to: target.id, resource: rt });
  }
}

export function onShareComplete(world: World, organism: Organism, target: Organism): void {
  organism.addXp(XP_PER_SHARE);
  organism.needs.social = Math.min(100, organism.needs.social + SHARE_SOCIAL_SHARER);
  target.needs.social   = Math.min(100, target.needs.social + SHARE_SOCIAL_RECIPIENT);
  organism.relationships.adjust(target.id, SHARE_RELATIONSHIP_GAIN);
  target.relationships.adjust(organism.id, SHARE_RELATIONSHIP_GAIN);
  applySocialHygieneDecay(organism, target);
  checkLevelUp(world, organism);
  maybeFormFaction(world, organism, target);
  shareResourceMemories(organism, target, world.tick);

  // Faction recruitment via share
  if (organism.factionId) {
    if (
      Math.random() < SHARE_CONVERT_CHANCE &&
      organism.relationships.get(target.id) >= SHARE_CONVERT_REL_THRESHOLD &&
      target.factionId !== organism.factionId
    ) {
      FactionManager.setFaction(world, target, organism.factionId, 'recruitment');
    }
  }
}

// ── Helpers ──

function applySocialHygieneDecay(organism: Organism, target: Organism): void {
  organism.needs.hygiene = Math.max(0, organism.needs.hygiene - HYGIENE_SOCIAL_DECAY);
  target.needs.hygiene   = Math.max(0, target.needs.hygiene - HYGIENE_SOCIAL_DECAY);
}

function maybeFormFaction(world: World, organism: Organism, target: Organism): void {
  if (!organism.factionId && !target.factionId) {
    const rel = organism.relationships.get(target.id);
    if (rel >= FACTION_FORM_REL_THRESHOLD) {
      FactionManager.create(world, [organism, target]);
    }
  }
}

function pickShareResource(organism: Organism, target: Organism): ResourceType | null {
  if (organism.inventory.total() <= 0) return null;
  const { plantFood, meatFood, water, wood } = organism.inventory;
  if (target.needs.fullness < 40 && (plantFood > 0 || meatFood > 0)) {
    return plantFood >= meatFood ? 'plantFood' : 'meatFood';
  }
  if (target.needs.hygiene < 40 && water > 0) return 'water';
  const food = plantFood + meatFood;
  if (food >= water && food >= wood && food > 0) return plantFood >= meatFood ? 'plantFood' : 'meatFood';
  if (water >= wood && water > 0) return 'water';
  if (wood > 0) return 'wood';
  return null;
}

function shareResourceMemories(organism: Organism, target: Organism, currentTick: number): void {
  const rel = organism.relationships.get(target.id);
  if (rel < MEMORY_SHARE_REL_THRESHOLD) return;

  const types: ResourceMemoryType[] = ['plantFood', 'meatFood', 'water', 'wood', 'corpse'];
  for (const type of types) {
    const myEntries   = [...organism.memory.recall(type)];
    const theirEntries = [...target.memory.recall(type)];

    for (const e of myEntries) {
      target.memory.remember(type, e.x, e.y, currentTick);
    }
    for (const e of theirEntries) {
      organism.memory.remember(type, e.x, e.y, currentTick);
    }
  }
}

function checkLevelUp(world: World, organism: Organism): void {
  while (organism.canLevelUp()) {
    organism.levelUp();
    log(world, 'level', `${organism.name} leveled to ${organism.level}`, organism.id, {});
  }
}
