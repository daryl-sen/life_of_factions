import { manhattan } from '../../core/utils';
import type { Agent } from '../entity/agent';
import type { World } from '../world/world';
import { onAttackTick } from './effects/combat-effects';
import { onTalkTick, onTalkComplete, onQuarrelTick, onQuarrelComplete, onHealTick, onHealComplete, onShareTick, onShareComplete } from './effects/social-effects';
import { onSleepTick, onSleepComplete, onEatComplete, onWashComplete } from './effects/survival-effects';
import { onHarvestComplete, onPickupComplete, onDepositComplete, onWithdrawComplete } from './effects/resource-effects';
import { onBuildFarmComplete } from './effects/build-effects';
import { onPoopComplete, onCleanComplete } from './effects/hygiene-effects';
import { onReproduceComplete } from './effects/reproduce-effects';
import { onPlayComplete } from './effects/play-effects';

const ENERGY_LOW_THRESHOLD = 40;
const FULLNESS_ACTION_DECAY_PER_SEC = 0.02;

// Actions that should NOT be canceled on low energy
const LOW_ENERGY_EXEMPT = new Set([
  'attack', 'sleep', 'harvest', 'eat', 'wash',
  'deposit', 'withdraw', 'pickup', 'poop', 'clean',
  'play', 'build_farm', 'await_mate',
]);

export class ActionProcessor {
  static process(world: World, agent: Agent, dtMs: number): void {
    if (!agent.action) return;
    const act = agent.action;

    // Sleep and await_mate are interruptible by attack
    if ((act.type === 'sleep' || act.type === 'await_mate') && agent._underAttack) {
      agent.action = null;
      return;
    }

    // Cancel reproduce on critical hunger
    if (act.type === 'reproduce' && agent.fullness <= 20) {
      agent.action = null;
      return;
    }

    // Cancel non-exempt actions on low energy
    if (agent.energy < ENERGY_LOW_THRESHOLD && !LOW_ENERGY_EXEMPT.has(act.type)) {
      agent.action = null;
      return;
    }

    act.remainingMs -= dtMs;
    act.tickCounterMs += dtMs;

    // Energy cost — uses pre-computed trait+level-scaled value from ActionFactory
    const costPerMs = (act.energyCostPerTick ?? 0) / 1000;
    agent.energy -= costPerMs * dtMs;

    // Fullness decay during all actions
    agent.drainFullness((FULLNESS_ACTION_DECAY_PER_SEC / 1000) * dtMs);

    // Target resolution
    const target = act.payload?.targetId
      ? world.agentsById.get(act.payload.targetId)
      : undefined;

    // Proximity checks
    if (target) {
      const dist = manhattan(agent.cellX, agent.cellY, target.cellX, target.cellY);
      if (act.type === 'attack') {
        if (dist > 2) { agent.action = null; return; }
      } else {
        if (dist !== 1) { agent.action = null; return; }
      }
    }

    if (act.type === 'harvest' && act.payload?.targetPos) {
      const tp = act.payload.targetPos;
      if (manhattan(agent.cellX, agent.cellY, tp.x, tp.y) > 1) { agent.action = null; return; }
    }

    if ((act.type === 'deposit' || act.type === 'withdraw') && agent.factionId) {
      const flag = world.grid.flags.get(agent.factionId);
      if (!flag || manhattan(agent.cellX, agent.cellY, flag.x, flag.y) > 1) {
        agent.action = null; return;
      }
    }

    if ((act.type === 'play' || act.type === 'clean' || act.type === 'pickup') && act.payload?.targetPos) {
      const tp = act.payload.targetPos;
      if (manhattan(agent.cellX, agent.cellY, tp.x, tp.y) > 1) { agent.action = null; return; }
    }

    // Periodic effects (every 500ms)
    if (act.tickCounterMs >= 500) {
      act.tickCounterMs = 0;
      applyPeriodicEffect(world, agent, target);
    }

    // Completion
    if (act.remainingMs <= 0) {
      applyCompletion(world, agent, target);
      agent.action = null;
    }
  }
}

function applyPeriodicEffect(world: World, agent: Agent, target: Agent | undefined): void {
  const act = agent.action!;
  switch (act.type) {
    case 'sleep': onSleepTick(world, agent); break;
    case 'attack': if (target) onAttackTick(world, agent, target); break;
    case 'heal': if (target) onHealTick(world, agent, target); break;
    case 'share': if (target) onShareTick(world, agent, target); break;
    case 'quarrel': if (target) onQuarrelTick(world, agent, target); break;
    case 'talk': if (target) onTalkTick(world, agent, target); break;
  }
}

function applyCompletion(world: World, agent: Agent, target: Agent | undefined): void {
  const act = agent.action!;
  switch (act.type) {
    case 'sleep': onSleepComplete(world, agent); break;
    case 'talk': if (target) onTalkComplete(world, agent, target); break;
    case 'quarrel': if (target) onQuarrelComplete(world, agent, target); break;
    case 'heal': if (target) onHealComplete(world, agent, target); break;
    case 'share': if (target) onShareComplete(world, agent, target); break;
    case 'eat': onEatComplete(world, agent); break;
    case 'wash': onWashComplete(world, agent); break;
    case 'harvest': onHarvestComplete(world, agent); break;
    case 'pickup': onPickupComplete(world, agent); break;
    case 'deposit': onDepositComplete(world, agent); break;
    case 'withdraw': onWithdrawComplete(world, agent); break;
    case 'poop': onPoopComplete(world, agent); break;
    case 'clean': onCleanComplete(world, agent); break;
    case 'play': onPlayComplete(world, agent); break;
    case 'build_farm': onBuildFarmComplete(world, agent); break;
    case 'reproduce': onReproduceComplete(world, agent, target); break;
  }
}
