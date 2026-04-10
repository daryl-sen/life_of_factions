import { TICK_MS } from '../../core/constants';
import { key, log } from '../../core/utils';
import type { World } from '../world/world';
import type { OrganismFactory } from '../entity/organism-factory';
import { FactionManager } from '../faction';
import { Spawner } from './spawner';
import { WorldUpdater } from './world-updater';
import { OrganismUpdater } from './organism-updater';

const HEAL_AURA_RADIUS = 4;
const HEAL_AURA_PER_TICK = 3.75;
const DISEASE_SPREAD_CHANCE = 0.03;
const DISEASE_SPREAD_BLOCK_THRESHOLD = 60;

export class SimulationEngine {

  constructor(
    private readonly organismUpdater: OrganismUpdater,
    private readonly factory: OrganismFactory,
  ) {}

  // ── Static seed helpers (delegate to Spawner) ──

  static seedInitialFood(world: World, count: number): void { Spawner.seedInitialFood(world, count); }
  static seedInitialWater(world: World, count: number): void { Spawner.seedInitialWater(world, count); }
  static seedInitialSaltWater(world: World, count: number): void { Spawner.seedInitialSaltWater(world, count); }
  static addCrop(world: World, x: number, y: number): boolean { return Spawner.addCrop(world, x, y); }
  static spawnWaterBlock(world: World, x: number, y: number, size: 'small' | 'large'): boolean {
    return Spawner.spawnWaterBlock(world, x, y, size);
  }
  static hasPoopNearby(world: World, x: number, y: number, radius: number): boolean {
    return Spawner.hasPoopNearby(world, x, y, radius);
  }

  // ── Post-tick: Flag healing aura ──

  private _applyFlagHealing(world: World): void {
    for (const organism of world.organisms) {
      if (!organism.factionId) continue;
      const flag = world.flags.get(organism.factionId);
      if (!flag) continue;
      const d = Math.abs(organism.cellX - flag.x) + Math.abs(organism.cellY - flag.y);
      if (d <= HEAL_AURA_RADIUS) organism.healBy(HEAL_AURA_PER_TICK);
    }
  }

  // ── Post-tick: Disease spread ──

  private _tickDiseaseSpread(world: World): void {
    for (const organism of world.organisms) {
      if (!organism.diseased) continue;
      const adj: [number, number][] = [
        [organism.cellX + 1, organism.cellY], [organism.cellX - 1, organism.cellY],
        [organism.cellX, organism.cellY + 1], [organism.cellX, organism.cellY - 1],
      ];
      for (const [nx, ny] of adj) {
        const id = world.grid.organismsByCell.get(key(nx, ny));
        if (!id) continue;
        const target = world.organismsById.get(id);
        if (!target || target.diseased) continue;
        if (organism.hasHygiene && target.needs.hygiene > DISEASE_SPREAD_BLOCK_THRESHOLD) continue;
        if (Math.random() < DISEASE_SPREAD_CHANCE) {
          target.diseased = true;
          log(world, 'hygiene', `${organism.name} spread disease to ${target.name}`, organism.id, { to: target.id });
        }
      }
    }
  }

  // ── Post-tick: Clean dead organisms and destroyed obstacles ──

  private _cleanDead(world: World): void {
    world.removeDeadOrganisms();

    const obstaclesToDelete: string[] = [];
    for (const [k, o] of world.obstacles) {
      if (o.hp <= 0) obstaclesToDelete.push(k);
    }
    for (const k of obstaclesToDelete) {
      const o = world.obstacles.get(k);
      world.obstacles.delete(k);
      if (o) log(world, 'destroy', `Obstacle @${o.x},${o.y} destroyed`, null, {});
    }
  }

  // ── Main tick ──

  tick(world: World): void {
    world.tick++;

    const organisms = world.organisms;

    // ── Path budget + whitelist ──
    const scarcity = world.foodBlocks.size / Math.max(1, organisms.length);
    const budgetThisTick =
      scarcity < 0.25
        ? Math.max(6, Math.floor(world.pathBudgetMax * 0.5))
        : world.pathBudgetMax;
    world.pathBudget = budgetThisTick;
    world._pathWhitelist.clear();

    const mobile = organisms.filter(o => !o.isImmobile);
    if (mobile.length > 0) {
      const eligible = mobile.filter(
        o => (o.lockMsRemaining || 0) <= 0 && (!o.path || o.pathIdx >= o.path.length) && !o.action
      );
      const pool = eligible.length ? eligible.sort((a, b) => a.energy - b.energy) : mobile;
      const k = Math.min(budgetThisTick || 30, pool.length);
      for (let i = 0; i < k; i++) {
        const idx = (world._pathRR + i) % pool.length;
        world._pathWhitelist.add(pool[idx].id);
      }
      world._pathRR = (world._pathRR + k) % pool.length;
    }

    // ── World updates ──
    WorldUpdater.update(world);

    // ── Spawner (crops, clouds, eggs) ──
    Spawner.tick(world, this.factory);

    // ── Per-organism update ──
    for (const organism of [...organisms]) {
      this.organismUpdater.update(organism, world, TICK_MS);
    }

    // ── Post-tick ──
    if (world.tick % 4 === 0) FactionManager.reconcile(world);
    this._applyFlagHealing(world);
    this._tickDiseaseSpread(world);
    this._cleanDead(world);
  }
}
