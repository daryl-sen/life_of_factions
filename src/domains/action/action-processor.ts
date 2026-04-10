import { manhattan } from '../../core/utils';
import type { Organism } from '../entity/organism';
import type { World } from '../world/world';
import { ACTION_REGISTRY } from './action-registry';
import { onAttackTick } from './effects/combat-effects';
import { onTalkTick, onTalkComplete, onQuarrelTick, onQuarrelComplete, onHealTick, onHealComplete, onShareTick, onShareComplete } from './effects/social-effects';
import { onSleepTick, onSleepComplete, onEatComplete, onDrinkComplete } from './effects/survival-effects';
import { onHarvestComplete, onPickupComplete, onDepositComplete, onWithdrawComplete } from './effects/resource-effects';
import { onBuildFarmComplete } from './effects/build-effects';
import { onPoopComplete, onCleanComplete } from './effects/hygiene-effects';
import { onReproduceComplete } from './effects/reproduce-effects';
import { onPlayComplete } from './effects/play-effects';

const ENERGY_LOW_THRESHOLD = 40;

// Actions that should NOT be canceled on low energy
const LOW_ENERGY_EXEMPT = new Set([
  'attack', 'sleep', 'harvest', 'eat', 'drink', 'deposit', 'withdraw', 'pickup',
  'poop', 'clean', 'play', 'build_farm', 'await_mate', 'photosynthesize',
]);

export class ActionProcessor {
  static process(world: World, organism: Organism, dtMs: number): void {
    if (!organism.action) return;
    const act = organism.action;

    // Sleep and await_mate are interruptible
    if ((act.type === 'sleep' || act.type === 'await_mate') && organism.diseased) {
      organism.action = null;
      return;
    }

    // Cancel reproduce on critical hunger
    if (act.type === 'reproduce' && organism.needs.fullness <= 20) {
      organism.action = null;
      return;
    }

    // Cancel non-exempt actions on low energy
    if (organism.energy < ENERGY_LOW_THRESHOLD && !LOW_ENERGY_EXEMPT.has(act.type)) {
      organism.action = null;
      return;
    }

    act.remainingMs -= dtMs;
    act.tickCounterMs += dtMs;

    // Energy cost
    const def = ACTION_REGISTRY.get(act.type);
    const costPerMs = (def?.baseEnergyCost ?? 0) / 1000;
    organism.energy -= costPerMs * dtMs;

    // Target resolution
    const target = act.payload?.targetId
      ? world.organismsById.get(act.payload.targetId)
      : undefined;

    // Proximity checks
    if (target) {
      const dist = manhattan(organism.cellX, organism.cellY, target.cellX, target.cellY);
      if (act.type === 'attack') {
        if (dist > 2) { organism.action = null; return; }
      } else {
        if (dist !== 1) { organism.action = null; return; }
      }
    }

    if (act.type === 'harvest' && act.payload?.targetPos) {
      const tp = act.payload.targetPos;
      if (manhattan(organism.cellX, organism.cellY, tp.x, tp.y) > 1) { organism.action = null; return; }
    }

    if ((act.type === 'deposit' || act.type === 'withdraw') && organism.factionId) {
      const flag = world.grid.flags.get(organism.factionId);
      if (!flag || manhattan(organism.cellX, organism.cellY, flag.x, flag.y) > 1) {
        organism.action = null; return;
      }
    }

    if ((act.type === 'play' || act.type === 'clean' || act.type === 'pickup') && act.payload?.targetPos) {
      const tp = act.payload.targetPos;
      if (manhattan(organism.cellX, organism.cellY, tp.x, tp.y) > 1) { organism.action = null; return; }
    }

    // Periodic effects (every 500ms)
    if (act.tickCounterMs >= 500) {
      act.tickCounterMs = 0;
      applyPeriodicEffect(world, organism, target);
    }

    // Completion
    if (act.remainingMs <= 0) {
      applyCompletion(world, organism, target);
      organism.action = null;
    }
  }
}

function applyPeriodicEffect(world: World, organism: Organism, target: Organism | undefined): void {
  const act = organism.action!;
  switch (act.type) {
    case 'sleep': onSleepTick(world, organism); break;
    case 'attack': if (target) onAttackTick(world, organism, target); break;
    case 'heal': if (target) onHealTick(world, organism, target); break;
    case 'share': if (target) onShareTick(world, organism, target); break;
    case 'quarrel': if (target) onQuarrelTick(world, organism, target); break;
    case 'talk': if (target) onTalkTick(world, organism, target); break;
  }
}

function applyCompletion(world: World, organism: Organism, target: Organism | undefined): void {
  const act = organism.action!;
  switch (act.type) {
    case 'sleep': onSleepComplete(world, organism); break;
    case 'talk': if (target) onTalkComplete(world, organism, target); break;
    case 'quarrel': if (target) onQuarrelComplete(world, organism, target); break;
    case 'heal': if (target) onHealComplete(world, organism, target); break;
    case 'share': if (target) onShareComplete(world, organism, target); break;
    case 'eat': onEatComplete(world, organism); break;
    case 'drink': onDrinkComplete(world, organism); break;
    case 'harvest': onHarvestComplete(world, organism); break;
    case 'pickup': onPickupComplete(world, organism); break;
    case 'deposit': onDepositComplete(world, organism); break;
    case 'withdraw': onWithdrawComplete(world, organism); break;
    case 'poop': onPoopComplete(world, organism); break;
    case 'clean': onCleanComplete(world, organism); break;
    case 'play': onPlayComplete(world, organism); break;
    case 'build_farm': onBuildFarmComplete(world, organism); break;
    case 'reproduce': onReproduceComplete(world, organism, target); break;
  }
}
