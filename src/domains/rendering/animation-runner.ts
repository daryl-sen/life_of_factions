import type { Agent } from '../entity/agent';
import type { ActionType } from '../action/types';

export type AnimationType =
  | 'shake' | 'bob' | 'pulse' | 'bounce'
  | 'shrink' | 'wiggle' | 'flash' | 'sway' | 'none';

export interface AnimationState {
  type: AnimationType;
  startTime: number;
  durationMs: number;
}

export interface AnimationTransform {
  dx: number;
  dy: number;
  rotation: number;
  scale: number;
}

/** Maps action types to their animation type. */
export const ACTION_ANIMATIONS: Record<ActionType, AnimationType> = {
  attack:     'shake',
  quarrel:    'shake',
  harvest:    'wiggle',
  eat:        'wiggle',
  reproduce:  'bounce',
  seek_mate:  'bob',
  await_mate: 'bob',
  sleep:      'sway',
  wash:       'wiggle',
  talk:       'bob',
  share:      'bob',
  heal:       'pulse',
  build_farm: 'wiggle',
  deposit:    'wiggle',
  withdraw:   'wiggle',
  pickup:     'wiggle',
  poop:       'wiggle',
  clean:      'wiggle',
  play:       'bounce',
  idle:       'none',
} as Record<ActionType, AnimationType>;

/** Animation types triggered by simulation events (levelUp, death, birth, takeDamage). */
export const EVENT_ANIMATIONS = {
  takeDamage: 'shake'  as AnimationType,
  death:      'shrink' as AnimationType,
  levelUp:    'flash'  as AnimationType,
  birth:      'bounce' as AnimationType,
};

const IDENTITY: AnimationTransform = { dx: 0, dy: 0, rotation: 0, scale: 1 };

/**
 * Tracks per-agent animation state.
 * Action-based animations are derived from the agent's current action;
 * event-triggered animations are stored per-agent and take priority.
 */
export class AnimationRunner {
  /** Event-triggered animation states (take priority over action animations). */
  private readonly _states = new Map<string, AnimationState>();

  /** Trigger an event-driven animation on an agent (e.g. levelUp, takeDamage). */
  trigger(agentId: string, type: AnimationType, durationMs = 500): void {
    this._states.set(agentId, { type, startTime: performance.now(), durationMs });
  }

  /**
   * Get the transform to apply when rendering this agent.
   * Event-driven state takes priority; falls back to current action animation.
   */
  getTransform(agent: Agent): AnimationTransform {
    const now = performance.now();
    const stateAnim = this._states.get(agent.id);

    // Clean up expired event animations
    if (stateAnim && now - stateAnim.startTime >= stateAnim.durationMs) {
      this._states.delete(agent.id);
    }

    const active = this._states.get(agent.id);
    const actionAnimType: AnimationType = agent.action
      ? (ACTION_ANIMATIONS[agent.action.type] ?? 'none')
      : 'none';

    const animType  = active?.type ?? actionAnimType;
    const startTime = active?.startTime ?? (agent.action?.startedAtMs ?? now);
    const duration  = active?.durationMs ?? 500;

    return this._computeTransform(animType, startTime, duration, now);
  }

  private _computeTransform(
    type: AnimationType,
    startTime: number,
    duration: number,
    now: number
  ): AnimationTransform {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);

    switch (type) {
      case 'shake':
        return { dx: Math.sin(elapsed / 30) * 3 * (1 - t), dy: 0, rotation: 0, scale: 1 };
      case 'bob':
        return { dx: 0, dy: Math.sin(elapsed / 200) * 2, rotation: 0, scale: 1 };
      case 'pulse':
        return { dx: 0, dy: 0, rotation: 0, scale: 1 + Math.sin(elapsed / 200) * 0.1 };
      case 'bounce':
        return { dx: 0, dy: -Math.abs(Math.sin(elapsed / 150)) * 6 * (1 - t), rotation: 0, scale: 1 };
      case 'shrink':
        return { dx: 0, dy: 0, rotation: 0, scale: 1 - t };
      case 'wiggle':
        return { dx: 0, dy: 0, rotation: Math.sin(elapsed / 80) * 0.1, scale: 1 };
      case 'flash':
        return { dx: 0, dy: 0, rotation: 0, scale: 1 + Math.sin(elapsed / 100) * 0.2 };
      case 'sway':
        return { dx: Math.sin(elapsed / 1000) * 1, dy: 0, rotation: Math.sin(elapsed / 1000) * 0.05, scale: 1 };
      case 'none':
      default:
        return IDENTITY;
    }
  }
}
