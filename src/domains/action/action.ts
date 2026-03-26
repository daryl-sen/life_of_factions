import type { ActionType, IActionPayload, IActionState } from '../../shared/types';
import { ACTION_DURATIONS, TUNE } from '../../shared/constants';
import { rndi } from '../../shared/utils';

export class ActionFactory {
  static create(type: ActionType, payload: IActionPayload | null = null): IActionState {
    const [mn, mx] = ACTION_DURATIONS[type];
    return {
      type,
      remainingMs: rndi(mn, mx),
      tickCounterMs: 0,
      payload,
    };
  }

  static createHarvest(resourceType: string, targetPos: { x: number; y: number }): IActionState {
    const dur = TUNE.harvest.duration[resourceType] ?? 1000;
    return {
      type: 'harvest',
      remainingMs: dur,
      tickCounterMs: 0,
      payload: { targetPos, resourceType },
    };
  }

  static tryStart(
    agent: { action: IActionState | null },
    type: ActionType,
    payload: IActionPayload | null = null
  ): boolean {
    if (agent.action) return false;
    agent.action = ActionFactory.create(type, payload);
    return true;
  }
}
