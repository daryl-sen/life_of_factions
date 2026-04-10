import type { TraitSet } from './types';
import type { FoodType } from '../../core/types';
import { TUNE } from '../../core/tuning';

/**
 * Pure functions deriving per-organism cost values from a TraitSet.
 * Called by action-factory.ts (per-action cost) and organism-updater.ts (passive drain).
 */

export function attackEnergyCost(traits: TraitSet): number {
  return TUNE.actionBaseCost.attack
    + traits.strength.value * TUNE.cost.attackEnergyPerStrength;
}

export function moveEnergyCost(traits: TraitSet): number {
  return TUNE.actionBaseCost.move
    + traits.agility.speedMult * TUNE.cost.moveEnergyPerAgility;
}

export function passiveEnergyDrainPerTick(traits: TraitSet): number {
  return TUNE.decay.baseEnergyPerTick
    + traits.perception.radius * TUNE.cost.perceptionPassiveDrain
    + traits.recall.memorySlots * TUNE.cost.recallSlotPassiveDrain;
}

/** Max HP adjustment from photosynthesis fragility penalty */
export function maxHpAdjustment(traits: TraitSet): number {
  return -traits.photosynthesis.value * TUNE.cost.photosynthesisHpPenaltyPerUnit;
}

/** Energy cost multiplier from leveling (higher level = more expensive actions) */
export function levelEnergyMultiplier(level: number): number {
  return 1 + (level - 1) * TUNE.cost.levelEnergyMultPerLevel;
}

/**
 * Efficiency of eating a given food type based on Carnivory expression.
 * Returns 0..1 where 0 = cannot eat, 1 = full nutrition.
 */
export function carnivoryEfficiency(traits: TraitSet, foodType: FoodType): number {
  const c = traits.carnivory.value;
  if (foodType === 'meat') {
    if (c < TUNE.functionalMin.carnivory) return 0;
    return Math.min(1, c / 50);
  }
  // Plant food efficiency drops at extreme carnivory
  if (c < 30) return 1;
  if (c > 100) return 0;
  return 1 - (c - 30) / 70;
}
