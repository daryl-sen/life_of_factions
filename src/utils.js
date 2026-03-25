export const rnd = (a, b) => Math.random() * (b - a) + a;
export const rndi = (a, b) => Math.floor(rnd(a, b + 1));
export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const key = (x, y) => `${x},${y}`;
export const fromKey = (k) => {
  const [x, y] = k.split(",").map(Number);
  return { x, y };
};
export const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
export const uuid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'x_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
export const generatePronounceableString = (length) => {
  const consonants = "BCDFGHJKLMNPQRSTVWXYZ";
  const vowels = "AEIOU";
  let result = "";

  // Determine the starting character type randomly
  let startWithConsonant = Math.random() < 0.5;

  for (let i = 0; i < length; i++) {
    if (
      (i % 2 === 0 && startWithConsonant) ||
      (i % 2 !== 0 && !startWithConsonant)
    ) {
      // Add a consonant
      result += consonants.charAt(
        Math.floor(Math.random() * consonants.length)
      );
    } else {
      // Add a vowel
      result += vowels.charAt(Math.floor(Math.random() * vowels.length));
    }
  }
  return result;
};
export class RingLog {
  constructor(limit = 100) {
    this.limit = limit;
    this.arr = [];
  }
  push(item) {
    this.arr.push(item);
    if (this.arr.length > this.limit) this.arr.shift();
  }
  list(activeSet, agentId = null) {
    if (!activeSet || activeSet.size === 0) return [];
    return this.arr.filter((x) => {
      if (!activeSet.has(x.cat)) return false;
      if (!agentId) return true;
      const to = x.extra?.to ?? null;
      const targetId = x.extra?.targetId ?? null;
      return (
        x.actorId === agentId || to === agentId || targetId === agentId
      );
    });
  }
}
export const getIdleEmoji = (a) => {
  if (a.energy <= 20) return "🤤";
  if (a.health <= 30) return "🤕";
  if (a.energy >= 80) return "🤩";
  return "🙂";
};
export const log = (world, cat, msg, actorId = null, extra = {}) => {
  world.log.push({ t: performance.now(), cat, msg, actorId, extra });
};
