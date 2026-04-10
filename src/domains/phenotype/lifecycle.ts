import type { ActionType } from '../action/types';
import { LifecycleStage, PhenotypeClass } from './types';
import { MOVESETS } from './moveset-registry';

/**
 * Determine the lifecycle stage for an organism based on age ticks.
 * Elder threshold is 80% of maxAgeTicks.
 */
export function getLifecycleStage(
  ageTicks: number,
  juvenileTicks: number,
  maxAgeTicks: number,
): LifecycleStage {
  if (ageTicks < juvenileTicks) return LifecycleStage.Juvenile;
  if (ageTicks > maxAgeTicks * 0.8) return LifecycleStage.Elder;
  return LifecycleStage.Adult;
}

/**
 * Get the current display emoji for an organism based on its phenotype,
 * lifecycle stage, base idle emoji, and current action.
 */
export function getCurrentEmoji(
  phenotype: PhenotypeClass,
  stage: LifecycleStage,
  baseIdleEmoji: string,
  actionType: ActionType | null,
): string {
  const moveset = MOVESETS[phenotype];

  if (stage === LifecycleStage.Juvenile) return moveset.juvenile;
  if (stage === LifecycleStage.Elder && moveset.elder) return moveset.elder;

  if (actionType && moveset.actionVariants[actionType]) {
    return moveset.actionVariants[actionType]!;
  }

  return baseIdleEmoji;
}
