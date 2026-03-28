import { TICK_MS } from '../../core/constants';
import { key, uuid, log } from '../../core/utils';
import type { World } from '../world/world';
import type { DeathCause } from '../world/types';
import { FactionManager } from '../faction';
import { Spawner } from './spawner';
import { WorldUpdater } from './world-updater';
import { AgentUpdater } from './agent-updater';

// ── Inlined TUNE constants ──

const HEAL_AURA_RADIUS = 4;
const HEAL_AURA_PER_TICK = 3.75;
const LOOT_BAG_DECAY_MS = 30000;

const DISEASE_SPREAD_CHANCE = 0.03;
const DISEASE_SPREAD_BLOCK_THRESHOLD = 60;

export class SimulationEngine {

  // ── Re-exports for backward compatibility ──
  // These delegate to the decomposed modules so existing callers still work.

  static seedInitialFood(world: World, count: number): void { Spawner.seedInitialFood(world, count); }
  static seedInitialWater(world: World, count: number): void { Spawner.seedInitialWater(world, count); }
  static seedInitialTrees(world: World, count: number): void { Spawner.seedInitialTrees(world, count); }
  static seedInitialSaltWater(world: World, count: number): void { Spawner.seedInitialSaltWater(world, count); }
  static addCrop(world: World, x: number, y: number): boolean { return Spawner.addCrop(world, x, y); }
  static addTree(world: World): boolean { return Spawner.addTree(world); }
  static spawnWaterBlock(world: World, x: number, y: number, size: 'small' | 'large'): boolean {
    return Spawner.spawnWaterBlock(world, x, y, size);
  }
  static hasPoopNearby(world: World, x: number, y: number, radius: number): boolean {
    return Spawner.hasPoopNearby(world, x, y, radius);
  }

  // ── Post-tick: Flag healing aura ──

  private static _applyFlagHealing(world: World): void {
    for (const agent of world.agents) {
      if (!agent.factionId) continue;
      const flag = world.flags.get(agent.factionId);
      if (!flag) continue;
      const d = Math.abs(agent.cellX - flag.x) + Math.abs(agent.cellY - flag.y);
      if (d <= HEAL_AURA_RADIUS) agent.healBy(HEAL_AURA_PER_TICK);
    }
  }

  // ── Post-tick: Disease spread ──

  private static _tickDiseaseSpread(world: World): void {
    for (const agent of world.agents) {
      if (!agent.diseased) continue;
      const adj: [number, number][] = [
        [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
        [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
      ];
      for (const [nx, ny] of adj) {
        const id = world.agentsByCell.get(key(nx, ny));
        if (!id) continue;
        const target = world.agentsById.get(id);
        if (!target || target.diseased) continue;
        if (target.hygiene > DISEASE_SPREAD_BLOCK_THRESHOLD) continue;
        if (Math.random() < DISEASE_SPREAD_CHANCE) {
          target.diseased = true;
          log(world, 'hygiene', `${agent.name} spread disease to ${target.name}`, agent.id, { to: target.id });
        }
      }
    }
  }

  // ── Post-tick: Clean dead agents and destroyed obstacles ──

  private static _cleanDead(world: World): void {
    const removedIds: string[] = [];
    const now = performance.now();
    world.agents = world.agents.filter((a) => {
      if (a.health <= 0) {
        // Inline loot bag drop on death
        if (a.inventoryTotal() > 0) {
          const inv = { food: a.inventory.food, water: a.inventory.water, wood: a.inventory.wood };
          const lk = key(a.cellX, a.cellY);
          const existing = world.lootBags.get(lk);
          if (existing) {
            existing.inventory.food += inv.food;
            existing.inventory.water += inv.water;
            existing.inventory.wood += inv.wood;
            existing.decayMs = LOOT_BAG_DECAY_MS;
          } else {
            world.lootBags.set(lk, {
              id: uuid(), x: a.cellX, y: a.cellY,
              inventory: inv,
              decayMs: LOOT_BAG_DECAY_MS,
            });
          }
          log(world, 'loot', `${a.name} dropped a loot bag`, a.id, { x: a.cellX, y: a.cellY });
        }
        world.agentsByCell.delete(key(a.cellX, a.cellY));
        world.agentsById.delete(a.id);
        removedIds.push(a.id);
        if (a.factionId && world.factions.has(a.factionId)) {
          world.factions.get(a.factionId)!.members.delete(a.id);
        }
        world.totalDeaths++;
        world.deathTimestamps.push(now);

        // Register death in family registry
        const ageMs = a.ageTicks * TICK_MS;
        world.familyRegistry.registerDeath(a.familyName, ageMs);

        let cause: DeathCause = 'killed';
        if (a.ageTicks >= a.maxAgeTicks) {
          cause = 'old_age';
        } else if (a.fullness <= 0) {
          cause = 'hunger';
        } else if (a.diseased) {
          cause = 'disease';
        }
        world.deadMarkers.push({
          cellX: a.cellX, cellY: a.cellY,
          cause, msRemaining: 10000,
        });

        log(world, 'death', `${a.name} died`, a.id, {});
        return false;
      }
      return true;
    });
    if (removedIds.length) {
      for (const a of world.agents) {
        for (const rid of removedIds) a.relationships.delete(rid);
      }
    }
    for (const a of world.agents) {
      for (const [rid] of a.relationships.entries()) {
        if (!world.agentsById.has(rid)) a.relationships.delete(rid);
      }
    }
    for (const [fid, f] of [...world.factions]) {
      let aliveCount = 0;
      for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
      if (aliveCount <= 1) FactionManager.disband(world, fid, 'no members');
    }
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

  static tick(world: World): void {
    world.tick++;

    // ── Path budget + whitelist ──
    const scarcity = world.foodBlocks.size / Math.max(1, world.agents.length);
    const budgetThisTick =
      scarcity < 0.25
        ? Math.max(6, Math.floor(world.pathBudgetMax * 0.5))
        : world.pathBudgetMax;
    world.pathBudget = budgetThisTick;
    world._pathWhitelist.clear();

    const n = world.agents.length;
    if (n > 0) {
      const eligible = world.agents.filter(
        (a) =>
          (a.lockMsRemaining || 0) <= 0 &&
          (!a.path || a.pathIdx >= a.path.length) &&
          !a.action
      );
      let pool: typeof world.agents;
      if (eligible.length) {
        eligible.sort((a, b) => a.energy - b.energy);
        pool = eligible;
      } else pool = world.agents;
      const k = Math.min(budgetThisTick || 30, pool.length);
      for (let i = 0; i < k; i++) {
        const idx = (world._pathRR + i) % pool.length;
        world._pathWhitelist.add(pool[idx].id);
      }
      world._pathRR = (world._pathRR + k) % pool.length;
    }

    // ── World updates (water decay, terrain, tree aging, block decay) ──
    WorldUpdater.update(world);

    // ── Spawner (crops, seedlings, trees, clouds, eggs) ──
    Spawner.tick(world);

    // ── Mark _underAttack flags ──
    for (const b of world.agents) b._underAttack = false;
    for (const b of world.agents) {
      if (b.action && b.action.type === 'attack' && b.action.payload?.targetId) {
        const t = world.agentsById.get(b.action.payload.targetId);
        if (t) t._underAttack = true;
      }
    }

    // ── Per-agent update ──
    for (const agent of world.agents) {
      AgentUpdater.update(world, agent);
    }

    // ── Post-tick ──
    if (world.tick % 4 === 0) FactionManager.reconcile(world);
    SimulationEngine._applyFlagHealing(world);
    SimulationEngine._tickDiseaseSpread(world);
    SimulationEngine._cleanDead(world);
  }
}
