import { log } from '../../../core/utils';
import type { Organism } from '../../entity/organism';
import type { World } from '../../world/world';
import { carnivoryEfficiency } from '../../genetics/cost-functions';

// ── Constants ──
const SLEEP_ENERGY_PER_TICK = 8;
const FULLNESS_FOOD_GAIN = 20;
const HYGIENE_DRINK_GAIN = 30;
const XP_PER_EAT = 5;

// ── Sleep ──

export function onSleepTick(_world: World, organism: Organism): void {
  organism.addEnergy(SLEEP_ENERGY_PER_TICK);
}

export function onSleepComplete(world: World, organism: Organism): void {
  log(world, 'sleep', `${organism.name} woke up`, organism.id, {});
}

// ── Eat ──

export function onEatComplete(world: World, organism: Organism): void {
  // Try plant food first, then meat food based on carnivory
  const plantEff = carnivoryEfficiency(organism.traits, 'plant');
  const meatEff  = carnivoryEfficiency(organism.traits, 'meat');

  let removed = 0;
  if (organism.inventory.plantFood > 0 && plantEff > 0) {
    removed = organism.inventory.remove('plantFood', 1);
    organism.addFullness(FULLNESS_FOOD_GAIN * plantEff);
  } else if (organism.inventory.meatFood > 0 && meatEff > 0) {
    removed = organism.inventory.remove('meatFood', 1);
    organism.addFullness(FULLNESS_FOOD_GAIN * meatEff);
  }
  if (removed <= 0) return;
  organism.addXp(XP_PER_EAT);
  log(world, 'eat', `${organism.name} ate food`, organism.id, {});
  checkLevelUp(world, organism);
}

// ── Drink ──

export function onDrinkComplete(world: World, organism: Organism): void {
  const removed = organism.inventory.remove('water', 1);
  if (removed <= 0) return;
  organism.needs.hygiene = Math.min(100, organism.needs.hygiene + HYGIENE_DRINK_GAIN);
  log(world, 'hygiene', `${organism.name} drank water`, organism.id, {});
}

function checkLevelUp(world: World, organism: Organism): void {
  while (organism.canLevelUp()) {
    organism.levelUp();
    log(world, 'level', `${organism.name} leveled to ${organism.level}`, organism.id, {});
  }
}
