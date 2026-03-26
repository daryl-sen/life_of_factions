import { TUNE } from '../../shared/constants';
import { key, rndi, clamp } from '../../shared/utils';
import { Pathfinder } from '../../shared/pathfinding';
import type { World } from '../world';
import type { Agent } from '../agent';
import { ActionFactory } from './action';

function lockAgent(world: World, id: string, ms: number): void {
  const ag = world.agentsById.get(id);
  if (!ag) return;
  ag.lockMsRemaining = Math.max(ag.lockMsRemaining || 0, ms);
}

export class InteractionEngine {
  /**
   * Decision priority hierarchy:
   * 1. Energy < 20          → mandatory sleep
   * 2. Under attack         → flee/retaliate
   * 3. Health < 30% maxHP   → seek faction flag
   * 4. Fullness < 20        → urgent food seeking
   * 5. Hygiene < 20         → urgent water seeking
   * 6. Energy < 40          → voluntary sleep
   * 7. Normal state:
   *    a. Fullness < 40     → proactive food seeking
   *    b. Hygiene < 40      → proactive water seeking
   *    c. Reproduction
   *    d. Attack
   *    e. Share/Heal/Talk
   */
  static consider(world: World, agent: Agent): void {
    // 1. Mandatory sleep
    if (agent.energy < TUNE.sleep.mandatoryThreshold) {
      if (InteractionEngine._trySleep(agent)) return;
    }

    // 2. Under attack — retaliate
    if (agent._underAttack) {
      if (InteractionEngine.chooseAttack(world, agent, true)) return;
    }

    // 3. Critical health — seek faction flag for aura healing
    if (agent.health < agent.maxHealth * 0.3) {
      if (InteractionEngine._seekFactionFlag(world, agent)) return;
    }

    // 4. Critical fullness — urgent food seeking
    if (agent.fullness < TUNE.fullness.criticalThreshold) {
      if (agent.inventory.food > 0) {
        ActionFactory.tryStart(agent, 'eat');
        return;
      }
      return;
    }

    // 5. Critical hygiene — urgent water seeking
    if (agent.hygiene < TUNE.hygiene.criticalThreshold) {
      if (agent.inventory.water > 0) {
        ActionFactory.tryStart(agent, 'drink');
        return;
      }
      // Signal: return without action/path so tick loop handles water seeking
      return;
    }

    // 6. Voluntary sleep
    if (agent.energy < TUNE.energyLowThreshold) {
      if (InteractionEngine._trySleep(agent)) return;
      // If sleep failed, try attack as fallback (old behavior)
      if (InteractionEngine.chooseAttack(world, agent, true)) return;
      return;
    }

    // 7. Normal state (energy >= 40)

    // 7a. Proactive food seeking
    if (agent.fullness < TUNE.fullness.seekThreshold) {
      if (agent.inventory.food > 0) {
        ActionFactory.tryStart(agent, 'eat');
        return;
      }
      return;
    }

    // 7b. Proactive hygiene seeking
    if (agent.hygiene < TUNE.hygiene.seekThreshold) {
      if (agent.inventory.water > 0) {
        ActionFactory.tryStart(agent, 'drink');
        return;
      }
      // Signal: return without action/path so tick loop handles water seeking
      return;
    }

    // 7c. Reproduction check
    const adj: [number, number][] = [
      [agent.cellX + 1, agent.cellY],
      [agent.cellX - 1, agent.cellY],
      [agent.cellX, agent.cellY + 1],
      [agent.cellX, agent.cellY - 1],
    ];
    for (const [nx, ny] of adj) {
      const id = world.agentsByCell.get(key(nx, ny));
      if (!id) continue;
      const b = world.agentsById.get(id);
      if (!b) continue;
      const rel = agent.relationships.get(b.id);
      if (
        rel >= TUNE.reproduction.relationshipThreshold &&
        agent.energy >= TUNE.reproduction.relationshipEnergy &&
        b.energy >= TUNE.reproduction.relationshipEnergy
      ) {
        if (ActionFactory.tryStart(agent, 'reproduce', { targetId: b.id })) {
          const dur = agent.action!.remainingMs;
          const reserve = 4;
          agent.drainEnergy(reserve);
          b.drainEnergy(reserve);
          lockAgent(world, agent.id, dur);
          lockAgent(world, b.id, dur);
          return;
        }
      }
    }

    // 7d. Attack
    if (InteractionEngine.chooseAttack(world, agent)) return;

    // 7e. Share/Heal/Talk
    if (InteractionEngine._chooseShareHealTalk(world, agent)) return;
  }

  private static _trySleep(agent: Agent): boolean {
    return ActionFactory.tryStart(agent, 'sleep');
  }

  private static _seekFactionFlag(world: World, agent: Agent): boolean {
    if (!agent.factionId) return false;
    const flag = world.flags.get(agent.factionId);
    if (!flag) return false;
    const dist = Math.abs(agent.cellX - flag.x) + Math.abs(agent.cellY - flag.y);
    if (dist <= TUNE.healAuraRadius) return false; // Already in aura range
    Pathfinder.planPathTo(world, agent, flag.x, flag.y);
    return agent.path !== null && agent.path.length > 0;
  }

  static chooseAttack(world: World, agent: Agent, preferEnemies = false): boolean {
    const candidates: Agent[] = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d === 0 || d > 2) continue;
        const id = world.agentsByCell.get(key(agent.cellX + dx, agent.cellY + dy));
        if (!id) continue;
        const b = world.agentsById.get(id);
        if (b) candidates.push(b);
      }
    }
    if (!candidates.length) return false;

    let pool = candidates;
    let p: number | undefined;
    if (preferEnemies) {
      const enemies = candidates.filter(
        (b) => agent.factionId && b.factionId && agent.factionId !== b.factionId
      );
      if (enemies.length) {
        pool = enemies;
        p = 1;
      }
    }
    if (p === undefined) {
      const hasEnemyNearby = candidates.some(
        (b) => agent.factionId && b.factionId && agent.factionId !== b.factionId
      );
      const bestRel = Math.max(
        ...candidates.map((b) => agent.relationships.get(b.id))
      );
      const relPenalty = Math.max(0, bestRel) * 0.6;
      p = clamp(agent.aggression + (hasEnemyNearby ? 0.25 : 0) - relPenalty, 0, 1);
    }
    if (Math.random() >= p) return false;

    pool.sort((b1, b2) => {
      const f1 =
        agent.factionId && b1.factionId && agent.factionId !== b1.factionId ? -0.5 : 0;
      const f2 =
        agent.factionId && b2.factionId && agent.factionId !== b2.factionId ? -0.5 : 0;
      return agent.relationships.get(b1.id) + f1 - (agent.relationships.get(b2.id) + f2);
    });
    const target = pool[0];
    if (agent.relationships.get(target.id) > 0.5 && Math.random() < 0.85) return false;
    if (ActionFactory.tryStart(agent, 'attack', { targetId: target.id })) return true;
    return false;
  }

  private static _chooseShareHealTalk(world: World, agent: Agent): boolean {
    const adj: [number, number][] = [
      [agent.cellX + 1, agent.cellY],
      [agent.cellX - 1, agent.cellY],
      [agent.cellX, agent.cellY + 1],
      [agent.cellX, agent.cellY - 1],
    ];
    const neighbors: Agent[] = [];
    for (const [nx, ny] of adj) {
      const id = world.agentsByCell.get(key(nx, ny));
      if (!id) continue;
      const b = world.agentsById.get(id);
      if (b) neighbors.push(b);
    }
    if (!neighbors.length) return false;

    const sameFactionNearby = neighbors.some(
      (b) => agent.factionId && b.factionId && agent.factionId === b.factionId
    );
    const pShare = clamp(agent.cooperation + (sameFactionNearby ? 0.25 : 0), 0, 1);

    if (Math.random() < pShare) {
      const sorted = neighbors.slice().sort((b1, b2) => {
        const same1 =
          agent.factionId && b1.factionId && agent.factionId === b1.factionId ? -0.3 : 0;
        const same2 =
          agent.factionId && b2.factionId && agent.factionId === b2.factionId ? -0.3 : 0;
        const need1 =
          b1.health / b1.maxHealth < b2.health / b2.maxHealth ? -0.2 : 0.2;
        return (
          same1 + need1 -
          (same2 + (b2.health / b2.maxHealth < b1.health / b1.maxHealth ? -0.2 : 0.2))
        );
      });
      const targ = sorted[0];
      const doHeal = targ.health < targ.maxHealth * 0.85;
      if (doHeal) {
        if (ActionFactory.tryStart(agent, 'heal', { targetId: targ.id })) {
          lockAgent(world, agent.id, agent.action!.remainingMs);
          lockAgent(world, targ.id, agent.action!.remainingMs);
          return true;
        }
      } else if (agent.inventoryTotal() > 0) {
        // Choose resource type based on target's needs
        const rt = targ.fullness < 40 && agent.inventory.food > 0 ? 'food'
          : targ.hygiene < 40 && agent.inventory.water > 0 ? 'water'
          : agent.inventory.food >= agent.inventory.water && agent.inventory.food >= agent.inventory.wood && agent.inventory.food > 0 ? 'food'
          : agent.inventory.water >= agent.inventory.wood && agent.inventory.water > 0 ? 'water'
          : agent.inventory.wood > 0 ? 'wood' : null;
        if (rt && ActionFactory.tryStart(agent, 'share', { targetId: targ.id, resourceType: rt })) {
          lockAgent(world, agent.id, agent.action!.remainingMs);
          lockAgent(world, targ.id, agent.action!.remainingMs);
          return true;
        }
      }
    }

    const targ = neighbors[rndi(0, neighbors.length - 1)];
    const rel = agent.relationships.get(targ.id);
    const pickQuarrel = rel < 0 && Math.random() < 0.5;
    const type = pickQuarrel ? 'quarrel' as const : 'talk' as const;
    if (ActionFactory.tryStart(agent, type, { targetId: targ.id })) {
      lockAgent(world, agent.id, agent.action!.remainingMs);
      lockAgent(world, targ.id, agent.action!.remainingMs);
      return true;
    }
    return false;
  }
}
