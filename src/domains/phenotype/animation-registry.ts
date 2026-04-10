import type { ActionType } from '../action/types';
import type { AnimationType } from './types';

export const ACTION_ANIMATIONS: Partial<Record<ActionType, AnimationType>> = {
  attack:         'shake',
  hunt:           'shake',
  harvest:        'wiggle',
  eat:            'wiggle',
  drink:          'wiggle',
  drink_saltwater:'wiggle',
  reproduce:      'bounce',
  sleep:          'sway',
  wash:           'wiggle',
  talk:           'bob',
  share:          'bob',
  heal:           'pulse',
  build_farm:     'wiggle',
  poop:           'wiggle',
  photosynthesize:'sway',
  idle:           'none',
};

/** Event-based animations triggered explicitly (not tied to action state) */
export const EVENT_ANIMATIONS = {
  takeDamage: 'shake'  as AnimationType,
  death:      'shrink' as AnimationType,
  levelUp:    'flash'  as AnimationType,
  birth:      'bounce' as AnimationType,
};
