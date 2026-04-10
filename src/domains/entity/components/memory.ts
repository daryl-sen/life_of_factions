import type { ResourceMemoryType, IResourceMemoryEntry } from '../../../core/types';

/**
 * ResourceMemory tracks the organism's remembered locations of resources.
 * Extracted from v4's inline Map on Agent into its own component.
 * Slot count is bounded by the organism's Recall trait.
 */
export class ResourceMemory {
  private entries: Map<ResourceMemoryType, IResourceMemoryEntry[]>;
  private maxSlots: number;

  constructor(maxSlots: number) {
    this.maxSlots = maxSlots;
    this.entries = new Map<ResourceMemoryType, IResourceMemoryEntry[]>([
      ['plantFood', []],
      ['meatFood',  []],
      ['water',     []],
      ['wood',      []],
      ['corpse',    []],
    ]);
  }

  remember(type: ResourceMemoryType, x: number, y: number, tick: number): void {
    const list = this.entries.get(type)!;
    const existing = list.findIndex(e => e.x === x && e.y === y);
    if (existing >= 0) {
      list[existing] = { x, y, tick };
      return;
    }
    if (list.length >= this.maxSlots) {
      let oldestIdx = 0;
      for (let i = 1; i < list.length; i++) {
        if (list[i].tick < list[oldestIdx].tick) oldestIdx = i;
      }
      list[oldestIdx] = { x, y, tick };
    } else {
      list.push({ x, y, tick });
    }
  }

  forget(type: ResourceMemoryType, x: number, y: number): void {
    const list = this.entries.get(type)!;
    const idx = list.findIndex(e => e.x === x && e.y === y);
    if (idx >= 0) list.splice(idx, 1);
  }

  recall(type: ResourceMemoryType): readonly IResourceMemoryEntry[] {
    return this.entries.get(type) ?? [];
  }
}
