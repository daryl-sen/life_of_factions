import type { Organism } from '../entity/organism';
import type { AnimationType } from '../phenotype/types';
import { ACTION_ANIMATIONS } from '../phenotype/animation-registry';

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

/**
 * Tracks per-organism animation state.
 * Action-based animations derive automatically from organism.action.
 * Event-based animations (damage, death, level-up) are triggered explicitly.
 */
export class AnimationRunner {
  private readonly states = new Map<string, AnimationState>();

  trigger(organismId: string, type: AnimationType, durationMs = 500): void {
    this.states.set(organismId, { type, startTime: performance.now(), durationMs });
  }

  clear(organismId: string): void {
    this.states.delete(organismId);
  }

  getTransform(organism: Organism): AnimationTransform {
    const stateAnim = this.states.get(organism.id);
    const actionType = organism.action?.type ?? 'idle';
    const actionAnim = ACTION_ANIMATIONS[actionType] ?? 'none';

    const animType    = stateAnim?.type ?? actionAnim;
    const startTime   = stateAnim?.startTime ?? performance.now();
    const durationMs  = stateAnim?.durationMs ?? 500;

    if (stateAnim && performance.now() - stateAnim.startTime > stateAnim.durationMs) {
      this.states.delete(organism.id);
    }

    return this.computeTransform(animType, startTime, durationMs);
  }

  private computeTransform(type: AnimationType, startTime: number, duration: number): AnimationTransform {
    const elapsed = performance.now() - startTime;
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
        return { dx: 0, dy: 0, rotation: 0, scale: Math.max(0, 1 - t) };
      case 'wiggle':
        return { dx: 0, dy: 0, rotation: Math.sin(elapsed / 80) * 0.1, scale: 1 };
      case 'flash':
        return { dx: 0, dy: 0, rotation: 0, scale: 1 + Math.sin(elapsed / 100) * 0.2 };
      case 'sway':
        return { dx: Math.sin(elapsed / 1000) * 1, dy: 0, rotation: Math.sin(elapsed / 1000) * 0.05, scale: 1 };
      case 'none':
      default:
        return { dx: 0, dy: 0, rotation: 0, scale: 1 };
    }
  }
}
