import type { ActionType, IActionState } from '../../shared/types';
import { ACTION_DURATIONS } from '../../shared/constants';
import { rndi } from '../../shared/utils';

export class ActionFactory {
  static create(type: ActionType, payload: { targetId?: string } | null = null): IActionState {
    const [mn, mx] = ACTION_DURATIONS[type];
    return {
      type,
      remainingMs: rndi(mn, mx),
      tickCounterMs: 0,
      payload,
    };
  }

  static tryStart(
    agent: { action: IActionState | null },
    type: ActionType,
    payload: { targetId?: string } | null = null
  ): boolean {
    if (agent.action) return false;
    agent.action = ActionFactory.create(type, payload);
    return true;
  }
}
