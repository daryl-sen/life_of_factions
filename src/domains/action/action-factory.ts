import { rnd } from '../../core/utils';
import type { Agent } from '../entity/agent';
import { ACTION_REGISTRY } from './action-registry';
import { computeActionCost } from '../genetics/cost-functions';
import type { ActionType, IActionState, IActionPayload } from './types';

/**
 * Create an action state for an agent.
 *
 * Duration scaling (preserved from v4):
 * - Metabolism: duration /= actionDurationMult (higher metabolism = faster)
 * - Inspiration: < 20 → 1.5× slower; > 70 → 0.75× faster
 *
 * v4.2 addition: energyCostPerTick is computed once via computeActionCost(),
 * which applies trait scaling (Strength for attacks) and level scaling.
 * ActionProcessor reads this pre-computed value instead of the registry base.
 */
export class ActionFactory {
  static create(
    type: ActionType,
    agent: Agent,
    payload?: IActionPayload
  ): IActionState {
    const def = ACTION_REGISTRY.get(type);
    if (!def) throw new Error(`Unknown action type: ${type}`);

    // Base duration from registry
    let duration = rnd(def.durationRange[0], def.durationRange[1]);

    // Scale by metabolism trait
    const metaMult = agent.traits.metabolism.actionDurationMult;
    if (metaMult > 0) {
      duration /= metaMult;
    }

    // Scale by inspiration
    const insp = agent.inspiration;
    if (insp < 20) {
      duration *= 1.5;
    } else if (insp > 70) {
      duration *= 0.75;
    }

    // v4.2: per-agent cost with trait and level scaling
    const energyCostPerTick = computeActionCost(agent.traits, agent.level, def);

    return {
      type,
      remainingMs: duration,
      tickCounterMs: 0,
      payload: payload ?? null,
      startedAtMs: performance.now(),
      totalMs: duration,
      energyCostPerTick,
    };
  }
}
