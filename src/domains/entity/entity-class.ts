import type { ActionType } from '../action/types';
import type { EntityClassName } from './types';

export interface EntityClassDef {
  readonly name: EntityClassName;
  readonly availableActions: ReadonlySet<ActionType>;
  readonly emojiMap: Readonly<Record<string, string>>;
  readonly statModifiers?: {
    readonly attackMult?: number;
    readonly speedMult?: number;
  };
}

export const ENTITY_CLASSES: Record<EntityClassName, EntityClassDef> = {
  baby: {
    name: 'baby',
    availableActions: new Set<ActionType>(['eat', 'wash']),
    emojiMap: {
      idle: '\u{1F476}',     // 👶
      eat: '\u{1F47C}',      // 👼
      wash: '\u{1F47C}',     // 👼
    },
  },
  adult: {
    name: 'adult',
    availableActions: new Set<ActionType>([
      'talk', 'quarrel', 'attack', 'heal', 'share',
      'reproduce', 'sleep', 'harvest', 'eat', 'wash',
      'deposit', 'withdraw', 'pickup', 'poop', 'clean',
      'play', 'build_farm',
    ]),
    emojiMap: {
      idle: '\u{1F642}',     // 🙂
      talk: '\u{1F604}',     // 😄
      quarrel: '\u{1F624}',  // 😤
      attack: '\u{1F621}',   // 😡
      heal: '\u{1F917}',     // 🤗
      share: '\u{1FAE2}',    // 🫢
      reproduce: '\u{1F60D}',// 😍
      sleep: '\u{1F634}',    // 😴
      harvest: '\u{1FAE8}',  // 🫨
      eat: '\u{1F914}',      // 🤔
      wash: '\u{1F914}',     // 🤔
      deposit: '\u{1F617}',  // 😗
      withdraw: '\u{1F617}', // 😗
      pickup: '\u{1F914}',   // 🤔
      poop: '\u{1F623}',     // 😣
      clean: '\u{1F637}',    // 😷
      play: '\u{1F92A}',     // 🤪
      build_farm: '\u{1F920}',// 🤠
    },
  },
  elder: {
    name: 'elder',
    availableActions: new Set<ActionType>([
      'talk', 'quarrel', 'attack', 'heal', 'share',
      'sleep', 'harvest', 'eat', 'wash',
      'deposit', 'withdraw', 'pickup', 'poop', 'clean',
      'play', 'build_farm',
    ]),
    emojiMap: {
      idle: '\u{1F9D3}',     // 🧓
      talk: '\u{1F604}',
      quarrel: '\u{1F624}',
      attack: '\u{1F621}',
      heal: '\u{1F917}',
      share: '\u{1FAE2}',
      sleep: '\u{1F634}',
      harvest: '\u{1FAE8}',
      eat: '\u{1F914}',
      wash: '\u{1F914}',
      deposit: '\u{1F617}',
      withdraw: '\u{1F617}',
      pickup: '\u{1F914}',
      poop: '\u{1F623}',
      clean: '\u{1F637}',
      play: '\u{1F92A}',
      build_farm: '\u{1F920}',
    },
    statModifiers: { attackMult: 0.7 },
  },
};
