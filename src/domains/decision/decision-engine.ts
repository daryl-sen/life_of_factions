import { GRID_SIZE, HOUSE_TIER_CONFIG } from '../../core/constants';
import { rndi, key } from '../../core/utils';
import { findHouseAt, getNextTier } from '../action/effects/house-effects';
import type { Agent } from '../entity/agent';
import { ENTITY_CLASSES } from '../entity/entity-class';
import { ACTION_REGISTRY } from '../action/action-registry';
import type { ActionType } from '../action/types';
import { Mood } from '../entity/types';
import { shouldFlee } from './flee-evaluator';
import { scoreAction } from './action-scorer';
import type { DecisionContext, ActionCandidate } from './types';
import type { World } from '../world/world';

/**
 * The decision engine replaces the old InteractionEngine's if-chain
 * with scored action selection.
 */
export class DecisionEngine {
  static decide(agent: Agent, context: DecisionContext, world: World): ActionCandidate | null {
    // Flee check (new behavior from Courage gene)
    if (shouldFlee(agent, context)) {
      return fleeCandidate(agent, context);
    }

    // Get available actions from entity class
    const classDef = ENTITY_CLASSES[agent.entityClass];
    const available = classDef.availableActions;

    // Score each available action
    const candidates: ActionCandidate[] = [];
    for (const actionType of available) {
      const def = ACTION_REGISTRY.get(actionType);
      if (!def) continue;

      // Quick requirement filters
      if (!passesRequirements(actionType, agent, context, world)) continue;

      const score = scoreAction(def, agent, context);
      if (score <= -Infinity) continue;

      // Resolve target for scored candidate
      const target = resolveTarget(actionType, agent, context, world);
      candidates.push({
        actionType,
        targetId: target?.targetId,
        targetPos: target?.targetPos,
        resourceType: (target as { resourceType?: string } | null)?.resourceType,
        score,
      });
    }

    if (candidates.length === 0) {
      return roamCandidate(agent);
    }

    // Select highest-scored action
    candidates.sort((a, b) => b.score - a.score);

    // If top score is Infinity (hard override), take it
    if (candidates[0].score === Infinity) return candidates[0];

    // Otherwise pick from top candidates with some stochasticity
    // Take top 3, weighted random
    const topN = candidates.slice(0, Math.min(3, candidates.length));
    const minScore = Math.min(...topN.map(c => c.score));
    const weights = topN.map(c => Math.max(c.score - minScore + 1, 0.1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < topN.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return topN[i];
    }
    return topN[0];
  }
}

function passesRequirements(type: ActionType, agent: Agent, ctx: DecisionContext, world: World): boolean {
  switch (type) {
    case 'eat':
      return agent.inventory.food > 0;
    case 'wash':
      return agent.inventory.water > 0;
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
      if (agent.pregnancy.active) return false;
      if (agent.entityClass === 'elder') return false;
      // Parthenogenesis: no partner needed
      if (agent.traits.parthenogenesis.canSelfReproduce) return true;
      // Need adjacent partner with sufficient relationship, not diseased
      const partners = ctx.nearbyAgents.filter(
        n => n.dist === 1 &&
          n.relationship >= 0.4 &&
          !n.agent.diseased && !agent.diseased
      );
      return partners.length > 0;
    }
    case 'seek_mate': {
      if (agent.traits.parthenogenesis.canSelfReproduce) return false;
      if (agent.pregnancy.active) return false;
      if (agent.entityClass === 'elder') return false;
      if (agent.matingTargetId) return false;
      if (ctx.mood !== Mood.HAPPY) return false;
      const seekPartners = ctx.nearbyAgents.filter(
        n => n.dist > 1 &&
          n.relationship >= 0.4 &&
          !n.agent.diseased && !agent.diseased &&
          !n.agent.pregnancy.active &&
          n.agent.entityClass !== 'elder' &&
          n.agent.entityClass !== 'baby'
      );
      return seekPartners.length > 0;
    }
    case 'harvest': {
      if (agent.inventoryFull()) return false;
      const adjRes = ctx.nearbyResources.filter(r => r.dist <= 1);
      return adjRes.length > 0;
    }
    case 'pickup': {
      if (agent.inventoryFull()) return false;
      const loot = ctx.nearbyBlocks.filter(b => b.type === 'lootBag' && b.dist <= 1);
      return loot.length > 0;
    }
    case 'deposit': {
      return ctx.nearOwnFlag && agent.inventoryTotal() >= 3;
    }
    case 'withdraw': {
      return ctx.nearOwnFlag && !agent.inventoryFull();
    }
    case 'poop':
      return agent.poopTimerMs > 0 && Math.random() < 0.10;
    case 'clean': {
      const poop = ctx.nearbyBlocks.filter(b => b.type === 'poop' && b.dist <= 1);
      return poop.length > 0 && agent.inspiration < 60;
    }
    case 'play': {
      // Need adjacent interactable (tree, obstacle, etc.)
      const trees = ctx.nearbyResources.filter(r => r.type === 'wood' && r.dist <= 1);
      return trees.length > 0 && agent.inspiration < 40;
    }
    case 'build_farm': {
      return agent.inventory.wood >= 3 && agent.energy >= 6;
    }
    case 'build_house': {
      return !agent.isInsideHouse &&
        agent.inventory.wood >= HOUSE_TIER_CONFIG.tent.woodCost &&
        agent.energy >= 6;
    }
    case 'upgrade_house': {
      if (agent.isInsideHouse) return false;
      // Find an adjacent owned house that can be upgraded
      const adj = ctx.nearbyHouses.filter(nb => nb.dist <= 1);
      return adj.some(nb => {
        const house = findHouseAt(world, nb.pos.x, nb.pos.y);
        if (!house || house.ownerId !== agent.id) return false;
        const nextTier = getNextTier(house.tier);
        if (!nextTier) return false;
        return agent.inventory.wood >= HOUSE_TIER_CONFIG[nextTier].woodCost;
      });
    }
    case 'enter_house': {
      if (agent.isInsideHouse) return false;
      return ctx.hasAccessibleHouse;
    }
    case 'exit_house': {
      return agent.isInsideHouse;
    }
    case 'sleep_in_house': {
      return agent.isInsideHouse;
    }
    default:
      return true;
  }
}

function resolveTarget(
  type: ActionType,
  agent: Agent,
  ctx: DecisionContext,
  world: World
): { targetId?: string; targetPos?: { x: number; y: number } } | null {
  switch (type) {
    case 'attack': {
      // Prefer enemies, then low-relationship agents
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
      // Pick weakest
      adj.sort((a, b) => (a.agent.health / a.agent.maxHealth) - (b.agent.health / b.agent.maxHealth));
      return adj.length ? { targetId: adj[0].agent.id } : null;
    }
    case 'share':
    case 'talk':
    case 'quarrel': {
      const adj = ctx.nearbyAgents.filter(n => n.dist === 1);
      if (!adj.length) return null;
      // For share: pick faction-mate or lowest relationship
      // For talk/quarrel: random neighbor
      const pick = adj[rndi(0, adj.length - 1)];
      return { targetId: pick.agent.id };
    }
    case 'reproduce': {
      if (agent.traits.parthenogenesis.canSelfReproduce) return {};
      const partners = ctx.nearbyAgents.filter(
        n => n.dist === 1 && n.relationship >= 0.4 && !n.agent.diseased
      );
      if (!partners.length) return null;
      return { targetId: partners[0].agent.id };
    }
    case 'seek_mate': {
      const seekPartners = ctx.nearbyAgents.filter(
        n => n.dist > 1 &&
          n.relationship >= 0.4 &&
          !n.agent.diseased &&
          !n.agent.pregnancy.active &&
          n.agent.entityClass !== 'elder' &&
          n.agent.entityClass !== 'baby'
      );
      if (!seekPartners.length) return null;
      seekPartners.sort((a, b) => b.relationship - a.relationship);
      return { targetId: seekPartners[0].agent.id };
    }
    case 'harvest': {
      const adjRes = ctx.nearbyResources.filter(r => r.dist <= 1);
      if (!adjRes.length) return null;
      const r = adjRes[0];
      let resourceType: string;
      if (r.type === 'food') resourceType = 'food_lq';
      else if (r.type === 'medicine') resourceType = 'medicine';
      else if (r.type === 'cactus') resourceType = 'cactus';
      else resourceType = r.type;
      return { targetPos: { x: r.pos.x, y: r.pos.y }, resourceType } as { targetPos: { x: number; y: number }; resourceType: string } & { targetId?: string };
    }
    case 'pickup': {
      const loot = ctx.nearbyBlocks.filter(b => b.type === 'lootBag' && b.dist <= 1);
      if (!loot.length) return null;
      return { targetPos: { x: loot[0].pos.x, y: loot[0].pos.y } };
    }
    case 'clean': {
      const poop = ctx.nearbyBlocks.filter(b => b.type === 'poop' && b.dist <= 1);
      if (!poop.length) return null;
      return { targetPos: { x: poop[0].pos.x, y: poop[0].pos.y } };
    }
    case 'play': {
      const trees = ctx.nearbyResources.filter(r => r.type === 'wood' && r.dist <= 1);
      if (!trees.length) return null;
      return { targetPos: { x: trees[0].pos.x, y: trees[0].pos.y } };
    }
    case 'deposit': {
      const { food, water, wood } = agent.inventory;
      if (food + water + wood <= 0) return null;
      const rt = food >= water && food >= wood ? 'food'
        : water >= wood ? 'water' : 'wood';
      return { resourceType: rt } as { resourceType: string } & { targetId?: string; targetPos?: { x: number; y: number } };
    }
    case 'withdraw': {
      const rt = agent.fullness <= agent.hygiene ? 'food' : 'water';
      return { resourceType: rt } as { resourceType: string } & { targetId?: string; targetPos?: { x: number; y: number } };
    }
    case 'upgrade_house': {
      // Find nearest adjacent owned house that can still be upgraded
      const adj = ctx.nearbyHouses.filter(nb => nb.dist <= 1);
      for (const nb of adj) {
        const house = findHouseAt(world, nb.pos.x, nb.pos.y);
        if (!house || house.ownerId !== agent.id) continue;
        if (!getNextTier(house.tier)) continue;
        return { targetPos: { x: nb.pos.x, y: nb.pos.y } };
      }
      return null;
    }
    case 'enter_house': {
      // Find nearest accessible house
      const sorted = [...ctx.nearbyHouses].sort((a, b) => a.dist - b.dist);
      for (const nb of sorted) {
        const house = findHouseAt(world, nb.pos.x, nb.pos.y);
        if (!house) continue;
        if (house.occupantIds.length >= house.capacity) continue;
        if (house.ownerId && house.familyName !== agent.familyName && house.familyName !== '') continue;
        return { targetPos: { x: nb.pos.x, y: nb.pos.y } };
      }
      return null;
    }
    case 'build_house':
    case 'exit_house':
    case 'sleep_in_house':
      return {};
    default:
      return {};
  }
}

function fleeCandidate(agent: Agent, context: DecisionContext): ActionCandidate | null {
  // Find the attacker and flee in the opposite direction
  const attacker = context.nearbyAgents.find(n => n.dist <= 2 && n.relationship < 0);
  if (!attacker) return roamCandidate(agent);

  const dx = agent.cellX - attacker.agent.cellX;
  const dy = agent.cellY - attacker.agent.cellY;
  const fleeX = Math.max(0, Math.min(GRID_SIZE - 1, agent.cellX + dx * 4 + rndi(-2, 2)));
  const fleeY = Math.max(0, Math.min(GRID_SIZE - 1, agent.cellY + dy * 4 + rndi(-2, 2)));

  return {
    actionType: 'sleep', // Placeholder — simulation handles flee as pathfinding
    targetPos: { x: fleeX, y: fleeY },
    score: 2000,
  };
}

function roamCandidate(agent: Agent): ActionCandidate {
  const range = 6;
  const tx = Math.max(0, Math.min(GRID_SIZE - 1, agent.cellX + rndi(-range, range)));
  const ty = Math.max(0, Math.min(GRID_SIZE - 1, agent.cellY + rndi(-range, range)));
  return {
    actionType: 'sleep', // Placeholder — simulation interprets as pathfind-to
    targetPos: { x: tx, y: ty },
    score: -100,
  };
}
