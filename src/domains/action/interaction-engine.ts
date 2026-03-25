import { TUNE } from '../../shared/constants';
import { key, rndi, clamp } from '../../shared/utils';
import type { World } from '../world';
import type { Agent } from '../agent';
import { ActionFactory } from './action';

function lockAgent(world: World, id: string, ms: number): void {
  const ag = world.agentsById.get(id);
  if (!ag) return;
  ag.lockMsRemaining = Math.max(ag.lockMsRemaining || 0, ms);
}

export class InteractionEngine {
  static consider(world: World, agent: Agent): void {
    if (agent.energy < TUNE.energyLowThreshold) {
      InteractionEngine.chooseAttack(world, agent, true);
    }

    // Check for reproduction opportunity
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

    if (InteractionEngine.chooseAttack(world, agent)) return;
    if (InteractionEngine._chooseHelpHealTalk(world, agent)) return;
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

  private static _chooseHelpHealTalk(world: World, agent: Agent): boolean {
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
    const pHelp = clamp(agent.cooperation + (sameFactionNearby ? 0.25 : 0), 0, 1);

    if (Math.random() < pHelp) {
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
      const type = doHeal ? 'heal' as const : 'help' as const;
      if (ActionFactory.tryStart(agent, type, { targetId: targ.id })) {
        lockAgent(world, agent.id, agent.action!.remainingMs);
        lockAgent(world, targ.id, agent.action!.remainingMs);
        return true;
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
