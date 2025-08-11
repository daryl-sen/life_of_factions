// utils.js
export const rnd = (a, b) => Math.random() * (b - a) + a;
export const rndi = (a, b) => Math.floor(rnd(a, b + 1));
export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const key = (x, y) => `${x},${y}`;
export const fromKey = (k) => {
  const [x, y] = k.split(",").map(Number);
  return { x, y };
};
export const manhattan = (ax, ay, bx, by) =>
  Math.abs(ax - bx) + Math.abs(ay - by);
export const name6 = () =>
  Array.from({ length: 6 }, () =>
    Math.random() < 0.5
      ? String.fromCharCode(65 + rndi(0, 25))
      : String(rndi(0, 9))
  ).join("");

export class RingLog {
  constructor(limit = 100) {
    this.limit = limit;
    this.arr = [];
  }
  push(item) {
    this.arr.push(item);
    if (this.arr.length > this.limit) this.arr.shift();
  }
  list(activeSet) {
    if (!activeSet || activeSet.size === 0) return [];
    return this.arr.filter((x) => activeSet.has(x.cat));
  }
}
