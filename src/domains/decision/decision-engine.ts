import { GRID_SIZE } from '../../core/constants';
import { rndi } from '../../core/utils';
import type { Organism } from '../entity/organism';
import type { World } from '../world/world';
import { ACTION_REGISTRY } from '../action/action-registry';
import type { ActionType } from '../action/types';
import { Mood } from '../entity/types';
import { LifecycleStage } from '../phenotype/types';
import { shouldFlee } from './flee-evaluator';
import { scoreAction } from './action-scorer';
import { ContextBuilder } from './context-builder';
import { ActionProcessor } from '../action/action-processor';
import type { ActionCandidate, DecisionContext } from './types';

export class DecisionEngine {
  /** Called each tick for mobile organisms */
  tick(organism: Organism, world: World, tickMs: number): void {
    // Process existing action
    if (organism.action) {
      ActionProcessor.process(world, organism, tickMs);
      return;
    }

    // Build context and decide next action
    const context = ContextBuilder.build(world, organism);

    if (shouldFlee(organism, context)) {
      const candidate = fleeCandidate(organism, context);
      if (candidate?.targetPos) {
        organism.goal = candidate.targetPos;
      }
      return;
    }

    // Get available actions based on lifecycle stage
    const available = getAvailableActions(organism);

    const candidates: ActionCandidate[] = [];
    for (const actionType of available) {
      const def = ACTION_REGISTRY.get(actionType);
      if (!def) continue;

      if (!passesRequirements(actionType, organism, context)) continue;

      const score = scoreAction(def, organism, context);
      if (score <= -Infinity) continue;

      const target = resolveTarget(actionType, organism, context);
      candidates.push({
        actionType,
        targetId: target?.targetId,
        targetPos: target?.targetPos,
        resourceType: (target as { resourceType?: string } | null)?.resourceType,
        score,
      });
    }

    if (candidates.length === 0) {
      const roam = roamCandidate(organism);
      organism.goal = roam.targetPos ?? null;
      return;
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates[0].score === Infinity) {
      applyCandidate(organism, candidates[0]);
      return;
    }

    const topN = candidates.slice(0, Math.min(3, candidates.length));
    const minScore = Math.min(...topN.map(c => c.score));
    const weights = topN.map(c => Math.max(c.score - minScore + 1, 0.1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < topN.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { applyCandidate(organism, topN[i]); return; }
    }
    applyCandidate(organism, topN[0]);
  }
}

function getAvailableActions(organism: Organism): ActionType[] {
  // Juveniles have a limited action set
  if (organism.lifecycleStage === LifecycleStage.Juvenile) {
    return ['sleep', 'eat', 'drink', 'talk', 'harvest', 'pickup'];
  }
  // Elders can't reproduce
  if (organism.lifecycleStage === LifecycleStage.Elder) {
    return ['sleep', 'eat', 'drink', 'attack', 'heal', 'share', 'talk', 'quarrel',
      'harvest', 'pickup', 'deposit', 'withdraw', 'poop', 'clean', 'play', 'build_farm'];
  }
  return ['sleep', 'eat', 'drink', 'attack', 'heal', 'share', 'talk', 'quarrel',
    'reproduce', 'seek_mate', 'await_mate', 'harvest', 'pickup', 'deposit', 'withdraw',
    'poop', 'clean', 'play', 'build_farm'];
}

function applyCandidate(organism: Organism, candidate: ActionCandidate): void {
  if (candidate.targetPos && !candidate.targetId) {
    organism.goal = candidate.targetPos;
    return;
  }
  const def = ACTION_REGISTRY.get(candidate.actionType);
  if (!def) return;
  const [minMs, maxMs] = def.durationRange;
  const durationMs = minMs + Math.random() * (maxMs - minMs);
  const now = performance.now();
  organism.action = {
    type: candidate.actionType,
    remainingMs: durationMs,
    tickCounterMs: 0,
    startedAtMs: now,
    totalMs: durationMs,
    payload: {
      targetId: candidate.targetId,
      targetPos: candidate.targetPos,
      resourceType: candidate.resourceType,
    },
  };
}

function passesRequirements(type: ActionType, organism: Organism, ctx: DecisionContext): boolean {
  switch (type) {
    case 'eat':
      return organism.inventory.plantFood > 0 || organism.inventory.meatFood > 0;
    case 'drink':
      return organism.inventory.water > 0;
    case 'sleep':
      return true;
    case 'attack': {
      const targets = ctx.nearbyAgents.filter(n => n.dist <= 2);
      return targets.length > 0;
    }
    case 'talk':
    case 'quarrel':
    case 'heal':
    case 'share': {
      const adj = ctx.nearbyAgents.filter(n => n.dist === 1);
      return adj.length > 0;
    }
    case 'reproduce': {
      if (!organism.pregnancy || organism.pregnancy.active) return false;
      if (organism.traits.parthenogenesis.canSelfReproduce) return true;
      const partners = ctx.nearbyAgents.filter(
        n => n.dist === 1 && n.relationship >= 0.4 && !n.agent.diseased && !organism.diseased
      );
      return partners.length > 0;
    }
    case 'seek_mate': {
      if (organism.traits.parthenogenesis.canSelfReproduce) return false;
      if (!organism.pregnancy || organism.pregnancy.active) return false;
      if (organism.lifecycleStage === LifecycleStage.Elder) return false;
      if (organism.matingTargetId) return false;
      if (ctx.mood !== Mood.HAPPY) return false;
      const seekPartners = ctx.nearbyAgents.filter(
        n => n.dist > 1 && n.relationship >= 0.4 && !n.agent.diseased && !organism.diseased &&
          !(n.agent.pregnancy?.active) && n.agent.lifecycleStage !== LifecycleStage.Juvenile &&
          n.agent.lifecycleStage !== LifecycleStage.Elder
      );
      return seekPartners.length > 0;
    }
    case 'harvest': {
      if (organism.inventory.isFull()) return false;
      const adjRes = ctx.nearbyResources.filter(r => r.dist <= 1);
      return adjRes.length > 0;
    }
    case 'pickup': {
      if (organism.inventory.isFull()) return false;
      const loot = ctx.nearbyBlocks.filter(b => b.type === 'lootBag' && b.dist <= 1);
      return loot.length > 0;
    }
    case 'deposit':
      return ctx.nearOwnFlag && organism.inventory.total() >= 3;
    case 'withdraw':
      return ctx.nearOwnFlag && !organism.inventory.isFull();
    case 'clean': {
      const poop = ctx.nearbyBlocks.filter(b => b.type === 'poop' && b.dist <= 1);
      return poop.length > 0 && organism.needs.inspiration < 60;
    }
    case 'play': {
      const adjRes = ctx.nearbyResources.filter(r => r.dist <= 1);
      return adjRes.length > 0 && organism.needs.inspiration < 40;
    }
    case 'build_farm':
      return organism.inventory.wood >= 3 && organism.energy >= 6;
    default:
      return true;
  }
}

function resolveTarget(
  type: ActionType,
  organism: Organism,
  ctx: DecisionContext
): { targetId?: string; targetPos?: { x: number; y: number }; resourceType?: string } | null {
  switch (type) {
    case 'attack': {
      const inRange = ctx.nearbyAgents.filter(n => n.dist <= 2);
      if (!inRange.length) return null;
      inRange.sort((a, b) => {
        const aEnemy = a.isEnemy ? -1 : 0;
        const bEnemy = b.isEnemy ? -1 : 0;
        return (a.relationship + aEnemy) - (b.relationship + bEnemy);
      });
      return { targetId: inRange[0].agent.id };
    }
    case 'heal': {
      const adj = ctx.nearbyAgents.filter(n => n.dist === 1);
      adj.sort((a, b) => (a.agent.health / a.agent.maxHealth) - (b.agent.health / b.agent.maxHealth));
      return adj.length ? { targetId: adj[0].agent.id } : null;
    }
    case 'share':
    case 'talk':
    case 'quarrel': {
      const adj = ctx.nearbyAgents.filter(n => n.dist === 1);
      if (!adj.length) return null;
      return { targetId: adj[rndi(0, adj.length - 1)].agent.id };
    }
    case 'reproduce': {
      if (organism.traits.parthenogenesis.canSelfReproduce) return {};
      const partners = ctx.nearbyAgents.filter(
        n => n.dist === 1 && n.relationship >= 0.4 && !n.agent.diseased
      );
      return partners.length ? { targetId: partners[0].agent.id } : null;
    }
    case 'seek_mate': {
      const seekPartners = ctx.nearbyAgents.filter(
        n => n.dist > 1 && n.relationship >= 0.4 && !n.agent.diseased && !(n.agent.pregnancy?.active)
      );
      if (!seekPartners.length) return null;
      seekPartners.sort((a, b) => b.relationship - a.relationship);
      return { targetId: seekPartners[0].agent.id };
    }
    case 'harvest': {
      const adjRes = ctx.nearbyResources.filter(r => r.dist <= 1);
      if (!adjRes.length) return null;
      const r = adjRes[0];
      return { targetPos: { x: r.pos.x, y: r.pos.y }, resourceType: r.type };
    }
    case 'pickup': {
      const loot = ctx.nearbyBlocks.filter(b => b.type === 'lootBag' && b.dist <= 1);
      return loot.length ? { targetPos: { x: loot[0].pos.x, y: loot[0].pos.y } } : null;
    }
    case 'clean': {
      const poop = ctx.nearbyBlocks.filter(b => b.type === 'poop' && b.dist <= 1);
      return poop.length ? { targetPos: { x: poop[0].pos.x, y: poop[0].pos.y } } : null;
    }
    case 'play': {
      const adjRes = ctx.nearbyResources.filter(r => r.dist <= 1);
      return adjRes.length ? { targetPos: { x: adjRes[0].pos.x, y: adjRes[0].pos.y } } : null;
    }
    case 'deposit': {
      const { plantFood, meatFood, water, wood } = organism.inventory;
      const food = plantFood + meatFood;
      const rt = food >= water && food >= wood ? (plantFood >= meatFood ? 'plantFood' : 'meatFood')
        : water >= wood ? 'water' : 'wood';
      return { resourceType: rt };
    }
    case 'withdraw': {
      const rt = organism.needs.fullness <= organism.needs.hygiene ? 'plantFood' : 'water';
      return { resourceType: rt };
    }
    default:
      return {};
  }
}

function fleeCandidate(organism: Organism, context: DecisionContext): ActionCandidate | null {
  const attacker = context.nearbyAgents.find(n => n.dist <= 2 && n.relationship < 0);
  if (!attacker) return roamCandidate(organism);

  const dx = organism.cellX - attacker.agent.cellX;
  const dy = organism.cellY - attacker.agent.cellY;
  const fleeX = Math.max(0, Math.min(GRID_SIZE - 1, organism.cellX + dx * 4 + rndi(-2, 2)));
  const fleeY = Math.max(0, Math.min(GRID_SIZE - 1, organism.cellY + dy * 4 + rndi(-2, 2)));

  return { actionType: 'sleep', targetPos: { x: fleeX, y: fleeY }, score: 2000 };
}

function roamCandidate(organism: Organism): ActionCandidate {
  const range = 6;
  const tx = Math.max(0, Math.min(GRID_SIZE - 1, organism.cellX + rndi(-range, range)));
  const ty = Math.max(0, Math.min(GRID_SIZE - 1, organism.cellY + rndi(-range, range)));
  return { actionType: 'sleep', targetPos: { x: tx, y: ty }, score: -100 };
}
