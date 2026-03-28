import { clamp } from '../../core/utils';
import type { Agent } from '../entity/agent';
import { NeedBand } from '../entity/types';
import { ActionTag } from '../action/types';
import type { ActionDef } from '../action/types';
import type { DecisionContext } from './types';

// ── Need band scores ──
const BAND_SCORES: Record<NeedBand, number> = {
  [NeedBand.CRITICAL]: 1000,
  [NeedBand.LOW]: 200,
  [NeedBand.NORMAL]: 20,
  [NeedBand.HIGH]: 0,
  [NeedBand.FULL]: -50,
};

/**
 * Score an action candidate for a given agent and context.
 * Higher score = more likely to be chosen.
 */
export function scoreAction(
  action: ActionDef,
  agent: Agent,
  context: DecisionContext
): number {
  let score = 0;

  // 1. Hard overrides — return Infinity/-Infinity for forced/blocked actions
  const override = hardOverride(action, agent, context);
  if (override !== null) return override;

  // 2. Need-based score
  score += needScore(action, context);

  // 3. Genetic modifier
  score += geneticScore(action, agent);

  // 4. Situational modifier
  score += situationalScore(action, agent, context);

  // 5. Random noise (±5% of score magnitude)
  const noise = (Math.random() - 0.5) * 0.1;
  score *= 1 + noise;

  return score;
}

function hardOverride(action: ActionDef, agent: Agent, context: DecisionContext): number | null {
  // Mandatory sleep
  if (action.type === 'sleep' && context.needBands['energy'] === NeedBand.CRITICAL) {
    return Infinity;
  }

  // Block reproduce if already pregnant
  if (action.type === 'reproduce' && context.pregnant) {
    return -Infinity;
  }

  // Elders can't reproduce
  if (action.type === 'reproduce' && agent.entityClass === 'elder') {
    return -Infinity;
  }

  return null;
}

function needScore(action: ActionDef, context: DecisionContext): number {
  let score = 0;
  const bands = context.needBands;

  // Sleep addresses energy need
  if (action.type === 'sleep') {
    score += BAND_SCORES[bands['energy'] ?? NeedBand.NORMAL] * 1.5;
  }

  // Eat addresses fullness need
  if (action.type === 'eat') {
    score += BAND_SCORES[bands['fullness'] ?? NeedBand.NORMAL] * 1.2;
  }

  // Wash addresses hygiene need
  if (action.type === 'wash') {
    score += BAND_SCORES[bands['hygiene'] ?? NeedBand.NORMAL] * 1.2;
  }

  // Harvest addresses fullness or hygiene depending on context
  if (action.type === 'harvest') {
    const fullBand = bands['fullness'] ?? NeedBand.NORMAL;
    const hygBand = bands['hygiene'] ?? NeedBand.NORMAL;
    score += Math.max(BAND_SCORES[fullBand], BAND_SCORES[hygBand]) * 0.8;
  }

  // Talk/share/heal address social need
  if (action.tags.has(ActionTag.SOCIAL)) {
    score += BAND_SCORES[bands['social'] ?? NeedBand.NORMAL] * 0.5;
  }

  // Play/clean address inspiration
  if (action.tags.has(ActionTag.LEISURE)) {
    const inspBand = bands['inspiration'] ?? NeedBand.NORMAL;
    score += BAND_SCORES[inspBand] * 0.4;
  }

  return score;
}

function geneticScore(action: ActionDef, agent: Agent): number {
  let score = 0;

  // Aggression boosts combat-tagged actions
  if (action.tags.has(ActionTag.COMBAT)) {
    score += agent.traits.aggression.baseProbability * 100;
  }

  // Cooperation boosts helpful-tagged actions
  if (action.tags.has(ActionTag.HELPFUL)) {
    score += agent.traits.cooperation.baseProbability * 100;
  }

  // Fidelity boosts faction-tagged actions
  if (action.tags.has(ActionTag.FACTION)) {
    score += (1 - agent.traits.fidelity.leaveProbability) * 30;
  }

  // Fertility boosts reproduction
  if (action.type === 'reproduce') {
    // Higher fertility (lower energyThreshold) means more eagerness
    const fertilityScore = (130 - agent.traits.fertility.energyThreshold) / 80;
    score += fertilityScore * 60;

    // End-of-life urgency
    const ageRatio = agent.maxAgeTicks > 0 ? agent.ageTicks / agent.maxAgeTicks : 0;
    if (ageRatio > agent.traits.fertility.urgencyAge) {
      score += 300;
    }
  }

  return score;
}

function situationalScore(action: ActionDef, agent: Agent, context: DecisionContext): number {
  let score = 0;

  // Under attack: massive boost to combat or flee behavior
  if (context.underAttack && action.tags.has(ActionTag.COMBAT)) {
    score += 500;
  }

  // Enemies nearby: boost attack
  if (action.type === 'attack') {
    const enemies = context.nearbyAgents.filter(n => n.isEnemy);
    if (enemies.length > 0) score += 150;

    // Penalize attack on strong allies
    const bestAlly = context.nearbyAgents
      .filter(n => n.sameFaction)
      .reduce((best, n) => n.relationship > best ? n.relationship : best, 0);
    score -= bestAlly * 200;
  }

  // Adjacent resources boost harvest
  if (action.type === 'harvest') {
    const adjResources = context.nearbyResources.filter(r => r.dist <= 1);
    if (adjResources.length > 0) score += 80;
  }

  // Near own flag boosts deposit
  if (action.type === 'deposit' && context.nearOwnFlag && agent.inventoryTotal() >= 3) {
    score += 100;
  }

  // Adjacent partner for reproduction
  if (action.type === 'reproduce') {
    const adjPartners = context.nearbyAgents.filter(
      n => n.dist === 1 && n.relationship >= 0.4 &&
        n.agent.energy >= agent.traits.fertility.energyThreshold &&
        !n.agent.diseased
    );
    if (adjPartners.length > 0) score += 200;
    else score -= 500; // No valid partner = don't bother
  }

  // Loot nearby boosts pickup
  if (action.type === 'pickup') {
    const loot = context.nearbyBlocks.filter(b => b.type === 'lootBag' && b.dist <= 1);
    if (loot.length > 0) score += 80;
  }

  // Poop nearby boosts clean
  if (action.type === 'clean') {
    const poop = context.nearbyBlocks.filter(b => b.type === 'poop' && b.dist <= 1);
    if (poop.length > 0) score += 40;
  }

  return score;
}
