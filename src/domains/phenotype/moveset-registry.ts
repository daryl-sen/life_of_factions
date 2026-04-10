import { PhenotypeClass } from './types';
import type { Moveset } from './types';

export const MOVESETS: Record<PhenotypeClass, Moveset> = {
  [PhenotypeClass.Plant]: {
    idle: ['🌲', '🌳', '🌴', '🌵', '🌻'],
    juvenile: '🌱',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.SessilePredator]: {
    idle: ['🪸'],
    juvenile: '🌱',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.Fungus]: {
    idle: ['🍄', '🪨'],
    juvenile: '🟤',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.Fish]: {
    idle: ['🐟', '🐠', '🐡'],
    juvenile: '🐟',
    elder: '🐡',
    actionVariants: {},
  },
  [PhenotypeClass.Amphibian]: {
    idle: ['🐸', '🦎', '🐢'],
    juvenile: '🐸',
    elder: '🐢',
    actionVariants: {},
  },
  [PhenotypeClass.PhotoCritter]: {
    idle: ['🐸', '🦎', '🐛', '🐌'],
    juvenile: '🐛',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.Person]: {
    idle: ['😊', '😐', '😟'],
    juvenile: '👶',
    elder: '🧓',
    actionVariants: {
      attack: '😡',
      sleep: '😴',
      eat: '😋',
    },
  },
  [PhenotypeClass.ColonyInsect]: {
    idle: ['🐜', '🐝'],
    juvenile: '🥚',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.Predator]: {
    idle: ['🐺', '🦊', '🐍'],
    juvenile: '🐺',
    elder: null,
    actionVariants: { attack: '🐺' },
  },
  [PhenotypeClass.Critter]: {
    idle: ['🐛', '🦎', '🐌'],
    juvenile: '🐛',
    elder: null,
    actionVariants: {},
  },
  [PhenotypeClass.Blob]: {
    idle: ['🫧'],
    juvenile: '🫧',
    elder: null,
    actionVariants: {},
  },
};

/** Pick the idle emoji for a phenotype deterministically from a seed value */
export function pickIdleEmoji(phenotype: PhenotypeClass, seed: number): string {
  const set = MOVESETS[phenotype].idle;
  return set[seed % set.length];
}
