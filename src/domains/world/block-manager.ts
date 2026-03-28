import { key, uuid } from '../../core/utils';
import { TICK_MS } from '../../core/constants';
import type { EventBus } from '../../core/event-bus';
import type { Grid } from './grid';
import type { IPoopBlock } from './types';

// ── Constants ──
const LOOT_BAG_DECAY_MS = 30000;
const POOP_DECAY_MS = 30000;

/**
 * Unified block lifecycle manager.
 * Replaces LootBagManager + PoopBlockManager.
 */
export class BlockManager {
  constructor(
    private readonly grid: Grid,
    private readonly events: EventBus
  ) {}

  // ── Loot Bags ──

  spawnLootBag(x: number, y: number, inventory: { food: number; water: number; wood: number }): void {
    const total = inventory.food + inventory.water + inventory.wood;
    if (total <= 0) return;
    const k = key(x, y);
    this.grid.lootBags.set(k, {
      id: uuid(), x, y,
      inventory: { ...inventory },
      decayMs: LOOT_BAG_DECAY_MS,
    });
    this.events.emit('block:added', { blockType: 'lootBag', position: { x, y } });
  }

  // ── Poop ──

  spawnPoop(world: { grid: Grid }, x: number, y: number): void {
    // Try agent cell first, then adjacent
    const positions = [
      [x, y],
      [x + 1, y], [x - 1, y],
      [x, y + 1], [x, y - 1],
    ];
    for (const [px, py] of positions) {
      if (px < 0 || py < 0 || px >= this.grid.size || py >= this.grid.size) continue;
      const k = key(px, py);
      if (this.grid.poopBlocks.has(k)) continue;
      if (this.grid.foodBlocks.has(k)) continue;
      if (this.grid.waterBlocks.has(k)) continue;
      this.grid.poopBlocks.set(k, {
        id: uuid(), x: px, y: py,
        decayMs: POOP_DECAY_MS,
      });
      this.events.emit('block:added', { blockType: 'poop', position: { x: px, y: py } });
      return;
    }
  }

  // ── Tick Decay ──

  tickDecay(): void {
    // Loot bag decay
    for (const [k, bag] of this.grid.lootBags) {
      bag.decayMs -= TICK_MS;
      if (bag.decayMs <= 0) {
        this.grid.lootBags.delete(k);
        this.events.emit('block:removed', { blockType: 'lootBag', position: { x: bag.x, y: bag.y } });
      }
    }

    // Poop decay
    for (const [k, poop] of this.grid.poopBlocks) {
      poop.decayMs -= TICK_MS;
      if (poop.decayMs <= 0) {
        this.grid.poopBlocks.delete(k);
        this.events.emit('block:removed', { blockType: 'poop', position: { x: poop.x, y: poop.y } });
      }
    }
  }
}
