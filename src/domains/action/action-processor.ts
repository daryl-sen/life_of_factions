import { TUNE } from '../../shared/constants';
import { manhattan, log, key } from '../../shared/utils';
import type { World } from '../world';
import type { Agent } from '../agent';
import { FactionManager } from '../faction';
import { AgentFactory } from '../agent';
import { InteractionEngine } from './interaction-engine';

export class ActionProcessor {
  static process(world: World, agent: Agent, dtMs: number): void {
    if (!agent.action) return;
    const act = agent.action;

    // Sleep is interruptible by attack
    if (act.type === 'sleep' && agent._underAttack) {
      agent.action = null;
      return;
    }

    // Don't cancel sleep, attack, harvest, eat, or drink on low energy
    if (agent.energy < TUNE.energyLowThreshold &&
      act.type !== 'attack' && act.type !== 'sleep' &&
      act.type !== 'harvest' && act.type !== 'eat' && act.type !== 'drink'
    ) {
      agent.action = null;
      return;
    }

    act.remainingMs -= dtMs;
    act.tickCounterMs += dtMs;
    const costPerMs = (TUNE.actionCost[act.type] || 0) / 1000;
    agent.energy -= costPerMs * dtMs;

    // Fullness decays during all actions
    agent.drainFullness((TUNE.fullness.actionDecayPerSec / 1000) * dtMs);

    const targ = act.payload?.targetId
      ? world.agentsById.get(act.payload.targetId)      : undefined;

    if (targ) {
      const dist = manhattan(agent.cellX, agent.cellY, targ.cellX, targ.cellY);
      if (act.type === 'attack') {
        if (dist > 2) { agent.action = null; return; }
      } else {
        if (dist !== 1) { agent.action = null; return; }
      }
    }

    // Harvest proximity: must stay adjacent to target position
    if (act.type === 'harvest' && act.payload?.targetPos) {
      const tp = act.payload.targetPos;
      const dist = manhattan(agent.cellX, agent.cellY, tp.x, tp.y);
      if (dist > 1) { agent.action = null; return; }
    }

    if (act.tickCounterMs >= 500) {
      act.tickCounterMs = 0;
      ActionProcessor._applyPeriodicEffect(world, agent, targ);
    }

    if (act.remainingMs <= 0) {
      ActionProcessor._applyCompletion(world, agent, targ);
      agent.action = null;
    }
  }

  private static _checkLevelUp(world: World, agent: Agent): void {
    while (agent.canLevelUp()) {
      agent.levelUp();
      log(world, 'level', `${agent.name} leveled to ${agent.level}`, agent.id, {});
    }
  }

  private static _applyPeriodicEffect(
    world: World,
    agent: Agent,
    targ: Agent | undefined
  ): void {
    const act = agent.action!;

    if (act.type === 'sleep') {
      agent.addEnergy(TUNE.sleep.energyPerTick);
    } else if (act.type === 'attack' && targ) {
      targ.takeDamage(agent.attack * 0.4);
      if (agent.factionId === targ.factionId) {
        Math.random() < 0.3
          ? (targ.factionId = null)
          : InteractionEngine.chooseAttack(world, targ, false);
      }
      agent.relationships.set(targ.id, agent.relationships.get(targ.id) - 0.2);
      log(world, 'attack', `${agent.name} hit ${targ.name}`, agent.id, { to: targ.id });
      if (targ.health <= 0) {
        agent.addXp(TUNE.xp.perKill);
        ActionProcessor._checkLevelUp(world, agent);
      }
    } else if (act.type === 'heal' && targ) {
      targ.healBy(2);
      log(world, 'heal', `${agent.name} healed ${targ.name}`, agent.id, { to: targ.id });
    } else if (act.type === 'help' && targ) {
      const high = agent.energy > agent.maxEnergy * 0.7;
      const ratio = high ? 0.2 : 0.1;
      const transfer = Math.max(0, agent.energy * ratio);
      if (transfer > 0) {
        agent.drainEnergy(transfer);
        targ.addEnergy(transfer);
        log(world, 'help', `${agent.name} gave ${transfer.toFixed(1)} energy to ${targ.name}`, agent.id, { to: targ.id, transfer });
      }
    } else if (act.type === 'quarrel' && targ) {
      const delta =
        (Math.random() < 0.5 ? -0.1 : 0.1) *
        (agent.factionId === targ.factionId ? 0.6 : 1);
      agent.relationships.set(targ.id, agent.relationships.get(targ.id) + delta);
      targ.relationships.set(agent.id, targ.relationships.get(agent.id) + delta);
      log(world, 'quarrel', `${agent.name} ${delta > 0 ? 'made peace with' : 'argued with'} ${targ.name}`, agent.id, { to: targ.id, delta });
    } else if (act.type === 'talk' && targ) {
      const delta =
        (Math.random() < 0.75 ? 0.14 : -0.06) *
        (agent.factionId === targ.factionId ? 1.1 : 0.8);
      agent.relationships.set(targ.id, agent.relationships.get(targ.id) + delta);
      targ.relationships.set(agent.id, targ.relationships.get(agent.id) + delta);
      log(world, 'talk', `${agent.name} talked with ${targ.name}`, agent.id, { to: targ.id, delta });
    }
  }

  private static _applyCompletion(
    world: World,
    agent: Agent,
    targ: Agent | undefined
  ): void {
    const act = agent.action!;

    // XP on action completion
    if (act.type === 'heal' && targ) {
      agent.addXp(TUNE.xp.perHeal);
      ActionProcessor._checkLevelUp(world, agent);
    } else if (act.type === 'help' && targ) {
      agent.addXp(TUNE.xp.perShare);
      ActionProcessor._checkLevelUp(world, agent);
    } else if (act.type === 'sleep') {
      log(world, 'sleep', `${agent.name} woke up`, agent.id, {});
    } else if (act.type === 'harvest') {
      ActionProcessor._completeHarvest(world, agent);
    } else if (act.type === 'eat') {
      ActionProcessor._completeEat(world, agent);
    } else if (act.type === 'drink') {
      ActionProcessor._completeDrink(world, agent);
    }

    if (targ && !agent.factionId && !targ.factionId) {
      const rel = agent.relationships.get(targ.id);
      if (
        (act.type === 'talk' || act.type === 'help' || act.type === 'heal') &&
        rel >= TUNE.factionFormRelThreshold
      ) {
        FactionManager.create(world, [agent, targ]);
      }
    }

    if (act.type === 'help' && targ && agent.factionId) {
      if (
        Math.random() < TUNE.helpConvertChance &&
        agent.relationships.get(targ.id) >= TUNE.helpConvertRelThreshold &&
        targ.factionId !== agent.factionId
      ) {
        FactionManager.setFaction(world, targ, agent.factionId, 'recruitment');
      }
    }

    if (act.type === 'reproduce' && targ && targ.health > 0) {
      if (manhattan(agent.cellX, agent.cellY, targ.cellX, targ.cellY) === 1) {
        const spots: [number, number][] = [
          [agent.cellX + 1, agent.cellY],
          [agent.cellX - 1, agent.cellY],
          [agent.cellX, agent.cellY + 1],
          [agent.cellX, agent.cellY - 1],
        ];
        const free = spots.find(([x, y]) => !world.grid.isBlocked(x, y));
        if (free) {
          agent.drainEnergy(12);
          targ.drainEnergy(12);
          const [x, y] = free;
          const child = AgentFactory.createChild(world, agent, targ, x, y);
          const pa = agent.factionId || null;
          const pb = targ.factionId || null;
          let chosen: string | null = null;
          if (pa && pb) chosen = Math.random() < 0.5 ? pa : pb;
          else chosen = pa || pb;
          if (chosen) FactionManager.setFaction(world, child, chosen, 'birth');
          world.totalBirths++;
          log(world, 'reproduce', `${agent.name} & ${targ.name} had ${child.name}`, agent.id, { child: child.id });
        }
      }
    }
  }

  private static _completeHarvest(world: World, agent: Agent): void {
    const act = agent.action!;
    const tp = act.payload?.targetPos;
    if (!tp) return;
    const k = key(tp.x, tp.y);
    const block = world.foodBlocks.get(k);
    if (!block || block.units <= 0) return;
    if (agent.inventoryFull()) return;
    block.units--;
    agent.addToInventory('food', 1);
    agent.addXp(TUNE.xp.perHarvest);
    log(world, 'harvest', `${agent.name} harvested food`, agent.id, { x: tp.x, y: tp.y });
    if (block.units <= 0) {
      world.foodBlocks.delete(k);
    }
    ActionProcessor._checkLevelUp(world, agent);
  }

  private static _completeEat(world: World, agent: Agent): void {
    const removed = agent.removeFromInventory('food', 1);
    if (removed <= 0) return;
    agent.addFullness(TUNE.fullness.cropGain);
    agent.addXp(TUNE.xp.perEat);
    agent.poopTimerMs = TUNE.eat.poopWindowMs;
    log(world, 'eat', `${agent.name} ate food`, agent.id, {});
    ActionProcessor._checkLevelUp(world, agent);
  }

  private static _completeDrink(world: World, agent: Agent): void {
    const removed = agent.removeFromInventory('water', 1);
    if (removed <= 0) return;
    agent.hygiene = Math.min(100, agent.hygiene + TUNE.drink.hygieneGain);
    log(world, 'eat', `${agent.name} drank water`, agent.id, {});
  }
}
