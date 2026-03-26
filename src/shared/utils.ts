import type { ILogEntry, LogCategory } from './types';
import { IDLE_EMOJIS } from './constants';

export const rnd = (a: number, b: number): number => Math.random() * (b - a) + a;
export const rndi = (a: number, b: number): number => Math.floor(rnd(a, b + 1));
export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;
export const key = (x: number, y: number): string => `${x},${y}`;
export const fromKey = (k: string): { x: number; y: number } => {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
};
export const manhattan = (ax: number, ay: number, bx: number, by: number): number =>
  Math.abs(ax - bx) + Math.abs(ay - by);

export const uuid = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'x_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

export const generatePronounceableString = (length: number): string => {
  const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
  const vowels = 'AEIOU';
  let result = '';
  const startWithConsonant = Math.random() < 0.5;
  for (let i = 0; i < length; i++) {
    if (
      (i % 2 === 0 && startWithConsonant) ||
      (i % 2 !== 0 && !startWithConsonant)
    ) {
      result += consonants.charAt(Math.floor(Math.random() * consonants.length));
    } else {
      result += vowels.charAt(Math.floor(Math.random() * vowels.length));
    }
  }
  return result;
};

export class RingLog {
  readonly limit: number;
  arr: ILogEntry[];

  constructor(limit = 100) {
    this.limit = limit;
    this.arr = [];
  }

  push(item: ILogEntry): void {
    this.arr.push(item);
    if (this.arr.length > this.limit) this.arr.shift();
  }

  list(activeSet: Set<LogCategory>, agentId: string | null = null): ILogEntry[] {
    if (!activeSet || activeSet.size === 0) return [];
    return this.arr.filter((x) => {
      if (!activeSet.has(x.cat)) return false;
      if (!agentId) return true;
      const to = (x.extra?.to as string) ?? null;
      const targetId = (x.extra?.targetId as string) ?? null;
      return x.actorId === agentId || to === agentId || targetId === agentId;
    });
  }
}

export const getIdleEmoji = (a: { energy: number; health: number; fullness: number }): string => {
  if (a.fullness <= 20) return IDLE_EMOJIS.lowFullness;
  if (a.energy <= 20) return IDLE_EMOJIS.lowEnergy;
  if (a.health <= 30) return IDLE_EMOJIS.lowHealth;
  if (a.energy >= 80) return IDLE_EMOJIS.highEnergy;
  return IDLE_EMOJIS.default;
};

export const log = (
  world: { log: RingLog },
  cat: LogCategory,
  msg: string,
  actorId: string | null = null,
  extra: Record<string, unknown> = {}
): void => {
  world.log.push({ t: performance.now(), cat, msg, actorId, extra });
};
