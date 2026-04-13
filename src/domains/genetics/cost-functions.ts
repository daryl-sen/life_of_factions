/**
 * Pure functions that derive per-agent energy costs from a TraitSet.
 * Other domains call these instead of using TUNE values directly
 * when the cost should scale with genetic traits.
 *
 * v4.2: Replaces fixed action costs with trait-scaled versions.
 * All functions are stateless and side-effect-free.
 */
import { TUNE } from '../../core/tuning';
import type { TraitSet } from './types';
import type { ActionDef } from '../action/types';

/** Energy cost to perform an attack action, scaled by Strength trait. */
export function attackEnergyCost(traits: TraitSet): number {
  return TUNE.actionBaseCost.attack
    + traits.strength.baseAttack * TUNE.cost.attackEnergyPerStrength;
}

/** Energy cost to move one step, scaled by Agility trait. */
export function moveEnergyCost(traits: TraitSet): number {
  return TUNE.actionBaseCost.move
    + traits.agility.speedMult * TUNE.cost.moveEnergyPerAgility;
}

/**
 * Passive energy drain per tick, scaled by Recall (memory slots add brain overhead).
 * Used in agent-updater.ts per-tick drain.
 */
export function passiveEnergyDrainPerTick(traits: TraitSet): number {
  return TUNE.decay.baseEnergyPerTick
    + traits.recall.memorySlots * TUNE.cost.recallSlotPassiveDrain;
}

/**
 * Level energy multiplier: each level above 1 adds +4% to all action costs.
 * Prevents Aptitude from being a free lunch at high levels.
 */
export function levelEnergyMultiplier(level: number): number {
  return 1 + (level - 1) * TUNE.cost.levelEnergyMultPerLevel;
}

/**
 * Compute the per-tick energy cost for a given action, accounting for
 * trait scaling and level scaling.
 *
 * Used by action-factory.ts when building an IActionState.
 */
export function computeActionCost(traits: TraitSet, level: number, def: ActionDef): number {
  let base: number;
  switch (def.type) {
    case 'attack':
    case 'quarrel':
      base = attackEnergyCost(traits);
      break;
    default:
      base = def.energyCost;
      break;
  }
  return base * levelEnergyMultiplier(level);
}
