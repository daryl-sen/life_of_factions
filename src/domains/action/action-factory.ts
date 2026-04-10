import { rnd } from '../../core/utils';
import type { Organism } from '../entity/organism';
import { ACTION_REGISTRY } from './action-registry';
import type { ActionType, IActionState, IActionPayload } from './types';

/**
 * Create an action state for an agent.
 * Duration is scaled by the agent's metabolism trait (actionDurationMult)
 * and by inspiration level (high inspiration = faster, low = slower).
 */
export class ActionFactory {
  static create(
    type: ActionType,
    organism: Organism,
    payload?: IActionPayload
  ): IActionState {
    const def = ACTION_REGISTRY.get(type);
    if (!def) throw new Error(`Unknown action type: ${type}`);

    // Base duration from registry
    let duration = rnd(def.durationRange[0], def.durationRange[1]);

    // Scale by metabolism trait
    const metaMult = organism.traits.metabolism.actionDurationMult;
    if (metaMult > 0) {
      duration /= metaMult;
    }

    // Scale by inspiration
    const insp = organism.needs.inspiration;
    if (insp < 20) {
      duration *= 1.5;
    } else if (insp > 70) {
      duration *= 0.75;
    }

    return {
      type,
      remainingMs: duration,
      tickCounterMs: 0,
      payload: payload ?? null,
      startedAtMs: performance.now(),
      totalMs: duration,
    };
  }
}
