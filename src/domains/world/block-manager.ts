import { key, uuid } from '../../core/utils';
import { TICK_MS } from '../../core/constants';
import { TUNE } from '../../core/tuning';
import type { EventBus } from '../../core/event-bus';
import type { Grid } from './grid';
import type { IPoopBlock, ICorpseBlock } from './types';
import type { Organism } from '../entity/organism';
import { PHENOTYPE_TRAITS } from '../phenotype/phenotype-registry';

const LOOT_BAG_DECAY_MS = 30000;
const POOP_DECAY_MS = 30000;

export class BlockManager {
  constructor(
    private readonly grid: Grid,
    private readonly events: EventBus,
  ) {}

  // ── Corpses ────────────────────────────────────────────────────────

  spawnCorpse(organism: Organism): ICorpseBlock | null {
    if (organism.traits.harvestable.value < TUNE.functionalMin.harvestable) return null;

    const isPlantLike = PHENOTYPE_TRAITS[organism.phenotype].immobile;
    const foodType: 'plant' | 'meat' = isPlantLike ? 'plant' : 'meat';
    const yieldPerSize = isPlantLike
      ? TUNE.corpse.plantYieldPerSize
      : TUNE.corpse.meatYieldPerSize;

    const total = organism.traits.size.value * yieldPerSize
                + organism.traits.harvestable.value * 0.5;

    const corpse: ICorpseBlock = {
      id: uuid(),
      x: organism.cellX,
      y: organism.cellY,
      foodType,
      totalResources:     total,
      remainingResources: total,
      decayMs:            TUNE.corpse.decayMs,
      emoji:              isPlantLike ? '🪵' : '🍖',
      sourcePhenotype:    organism.phenotype,
    };

    this.grid.corpseBlocks.set(key(corpse.x, corpse.y), corpse);
    this.events.emit('corpse:created', { corpseId: corpse.id, position: { x: corpse.x, y: corpse.y } });
    return corpse;
  }

  removeCorpse(id: string): void {
    for (const [k, c] of this.grid.corpseBlocks) {
      if (c.id === id) {
        this.grid.corpseBlocks.delete(k);
        this.events.emit('corpse:decayed', { corpseId: id, position: { x: c.x, y: c.y } });
        return;
      }
    }
  }

  decayCorpses(tickMs: number): void {
    for (const [k, corpse] of this.grid.corpseBlocks) {
      corpse.decayMs -= tickMs;
      if (corpse.decayMs <= 0) {
        this.grid.corpseBlocks.delete(k);
        this.events.emit('corpse:decayed', { corpseId: corpse.id, position: { x: corpse.x, y: corpse.y } });
      }
    }
  }

  // ── Loot Bags ─────────────────────────────────────────────────────

  spawnLootBag(organism: Organism): void {
    const inv = organism.inventory;
    const total = inv.plantFood + inv.meatFood + inv.water + inv.wood;
    if (total <= 0) return;
    const k = key(organism.cellX, organism.cellY);
    this.grid.lootBags.set(k, {
      id: uuid(),
      x: organism.cellX,
      y: organism.cellY,
      inventory: {
        plantFood: inv.plantFood,
        meatFood:  inv.meatFood,
        water:     inv.water,
        wood:      inv.wood,
      },
      decayMs: LOOT_BAG_DECAY_MS,
    });
    this.events.emit('block:added', { blockType: 'lootBag', position: { x: organism.cellX, y: organism.cellY } });
  }

  // ── Poop ──────────────────────────────────────────────────────────

  spawnPoop(x: number, y: number): void {
    const positions = [
      [x, y], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
    ];
    for (const [px, py] of positions) {
      if (px < 0 || py < 0 || px >= this.grid.size || py >= this.grid.size) continue;
      const k = key(px, py);
      if (this.grid.poopBlocks.has(k) || this.grid.foodBlocks.has(k) || this.grid.waterBlocks.has(k)) continue;
      this.grid.poopBlocks.set(k, { id: uuid(), x: px, y: py, decayMs: POOP_DECAY_MS });
      this.events.emit('block:added', { blockType: 'poop', position: { x: px, y: py } });
      return;
    }
  }

  // ── Tick Decay ────────────────────────────────────────────────────

  tickDecay(tickMs: number = TICK_MS): void {
    for (const [k, bag] of this.grid.lootBags) {
      bag.decayMs -= tickMs;
      if (bag.decayMs <= 0) {
        this.grid.lootBags.delete(k);
        this.events.emit('block:removed', { blockType: 'lootBag', position: { x: bag.x, y: bag.y } });
      }
    }

    for (const [k, poop] of this.grid.poopBlocks) {
      poop.decayMs -= tickMs;
      if (poop.decayMs <= 0) {
        this.grid.poopBlocks.delete(k);
        this.events.emit('block:removed', { blockType: 'poop', position: { x: poop.x, y: poop.y } });
      }
    }

    this.decayCorpses(tickMs);
  }
}
