import type { ActionType, IActionPayload, IActionState } from '../../shared/types';
import { ACTION_DURATIONS, TUNE } from '../../shared/constants';
import { rndi } from '../../shared/utils';

export class ActionFactory {
  static inspirationMultiplier(inspiration: number): number {
    if (inspiration < TUNE.inspiration.lowThreshold) return TUNE.inspiration.lowMultiplier;
    if (inspiration > TUNE.inspiration.highThreshold) return TUNE.inspiration.highMultiplier;
    return 1;
  }

  static create(type: ActionType, payload: IActionPayload | null = null, inspiration = 50): IActionState {
    const [mn, mx] = ACTION_DURATIONS[type];
    const mult = ActionFactory.inspirationMultiplier(inspiration);
    return {
      type,
      remainingMs: Math.round(rndi(mn, mx) * mult),
      tickCounterMs: 0,
      payload,
    };
  }

  static createHarvest(resourceType: string, targetPos: { x: number; y: number }, inspiration = 50): IActionState {
    const dur = TUNE.harvest.duration[resourceType] ?? 1000;
    const mult = ActionFactory.inspirationMultiplier(inspiration);
    return {
      type: 'harvest',
      remainingMs: Math.round(dur * mult),
      tickCounterMs: 0,
      payload: { targetPos, resourceType },
    };
  }

  static tryStart(
    agent: { action: IActionState | null; inspiration?: number },
    type: ActionType,
    payload: IActionPayload | null = null
  ): boolean {
    if (agent.action) return false;
    agent.action = ActionFactory.create(type, payload, agent.inspiration ?? 50);
    return true;
  }
}
