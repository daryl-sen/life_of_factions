import { clamp } from '../../shared/utils';

const MAX_REL = 80;

export class RelationshipMap {
  private readonly _map: Map<string, number>;

  constructor(initial?: Map<string, number>) {
    this._map = initial ? new Map(initial) : new Map();
  }

  get(id: string): number {
    return this._map.get(id) ?? 0;
  }

  set(id: string, val: number): void {
    val = clamp(val, -1, 1);
    if (Math.abs(val) < 0.02) {
      this._map.delete(id);
      return;
    }
    this._map.set(id, val);
    if (this._map.size > MAX_REL) {
      const prunable = [...this._map.entries()].sort(
        ([, v1], [, v2]) => Math.abs(v1) - Math.abs(v2)
      );
      const toDrop = this._map.size - MAX_REL;
      for (let i = 0; i < toDrop; i++) this._map.delete(prunable[i][0]);
    }
  }

  delete(id: string): void {
    this._map.delete(id);
  }

  has(id: string): boolean {
    return this._map.has(id);
  }

  keys(): IterableIterator<string> {
    return this._map.keys();
  }

  entries(): IterableIterator<[string, number]> {
    return this._map.entries();
  }

  get size(): number {
    return this._map.size;
  }

  toRawMap(): Map<string, number> {
    return this._map;
  }
}
