import { clamp } from './utils.js';

export const getRel = (a, bId) => a.relationships.get(bId) ?? 0;
export const setRel = (a, bId, val) => {
  val = clamp(val, -1, 1);
  if (Math.abs(val) < 0.02) {
    a.relationships.delete(bId);
    return;
  }
  a.relationships.set(bId, val);
  const MAX_REL = 80;
  if (a.relationships.size > MAX_REL) {
    const prunable = [...a.relationships.entries()].sort(
      ([_1, v1], [_2, v2]) => Math.abs(v1) - Math.abs(v2)
    );
    const toDrop = a.relationships.size - MAX_REL;
    for (let i = 0; i < toDrop; i++) a.relationships.delete(prunable[i][0]);
  }
};
