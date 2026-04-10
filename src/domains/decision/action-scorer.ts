import { clamp } from '../../core/utils';
import type { Organism } from '../entity/organism';
import { NeedBand, Mood } from '../entity/types';
import { ActionTag } from '../action/types';
import type { ActionDef } from '../action/types';
import type { DecisionContext } from './types';
import { LifecycleStage } from '../phenotype/types';

// ── Need band scores ──
const BAND_SCORES: Record<NeedBand, number> = {
  [NeedBand.CRITICAL]: 1000,
  [NeedBand.LOW]: 200,
  [NeedBand.NORMAL]: 20,
  [NeedBand.HIGH]: 0,
  [NeedBand.FULL]: -50,
};

// suppress unused import warning
void clamp;

/**
 * Score an action candidate for a given organism and context.
 * Higher score = more likely to be chosen.
 */
export function scoreAction(
  action: ActionDef,
  organism: Organism,
  context: DecisionContext
): number {
  let score = 0;

  // 1. Hard overrides — return Infinity/-Infinity for forced/blocked actions
  const override = hardOverride(action, organism, context);
  if (override !== null) return override;

  // 2. Need-based score
  score += needScore(action, context);

  // 3. Genetic modifier
  score += geneticScore(action, organism);

  // 4. Mood modifier
  score += moodScore(action, organism, context);

  // 5. Situational modifier
  score += situationalScore(action, organism, context);

  // 6. Random noise (±5% of score magnitude)
  const noise = (Math.random() - 0.5) * 0.1;
  score *= 1 + noise;

  return score;
}

function hardOverride(action: ActionDef, organism: Organism, context: DecisionContext): number | null {
  // Mandatory sleep
  if (action.type === 'sleep' && context.needBands['energy'] === NeedBand.CRITICAL) {
    return Infinity;
  }

  // Block reproduce if already pregnant
  if (action.type === 'reproduce' && context.pregnant) {
    return -Infinity;
  }

  // Elders can't reproduce
  if (action.type === 'reproduce' && organism.lifecycleStage === LifecycleStage.Elder) {
    return -Infinity;
  }

  // Unhappy/frustrated agents won't initiate reproduction
  if (action.type === 'reproduce' && (context.mood === Mood.UNHAPPY || context.mood === Mood.FRUSTRATED)) {
    return -Infinity;
  }

  // Block seek_mate when unhappy or frustrated
  if (action.type === 'seek_mate' && (context.mood === Mood.UNHAPPY || context.mood === Mood.FRUSTRATED)) {
    return -Infinity;
  }

  return null;
}

function needScore(action: ActionDef, context: DecisionContext): number {
  let score = 0;
  const bands = context.needBands;

  if (action.type === 'sleep') {
    score += BAND_SCORES[bands['energy'] ?? NeedBand.NORMAL] * 1.5;
  }
  if (action.type === 'eat') {
    score += BAND_SCORES[bands['fullness'] ?? NeedBand.NORMAL] * 1.2;
  }
  if (action.type === 'drink') {
    score += BAND_SCORES[bands['hygiene'] ?? NeedBand.NORMAL] * 1.2;
  }
  if (action.type === 'harvest') {
    const fullBand = bands['fullness'] ?? NeedBand.NORMAL;
    const hygBand  = bands['hygiene']  ?? NeedBand.NORMAL;
    score += Math.max(BAND_SCORES[fullBand], BAND_SCORES[hygBand]) * 0.8;
  }
  if (action.tags.has(ActionTag.SOCIAL)) {
    score += BAND_SCORES[bands['social'] ?? NeedBand.NORMAL] * 0.5;
  }
  if (action.tags.has(ActionTag.LEISURE)) {
    score += BAND_SCORES[bands['inspiration'] ?? NeedBand.NORMAL] * 0.4;
  }

  return score;
}

function geneticScore(action: ActionDef, organism: Organism): number {
  let score = 0;

  if (action.tags.has(ActionTag.COMBAT)) {
    score += organism.traits.aggression.baseProbability * 100;
  }
  if (action.tags.has(ActionTag.HELPFUL)) {
    score += organism.traits.cooperation.baseProbability * 100;
  }
  if (action.tags.has(ActionTag.FACTION)) {
    score += (1 - organism.traits.fidelity.leaveProbability) * 30;
  }
  if (action.type === 'reproduce' || action.type === 'seek_mate') {
    const fertilityScore = (130 - organism.traits.fertility.energyThreshold) / 80;
    score += fertilityScore * 60;

    const ageRatio = organism.maxAgeTicks > 0 ? organism.ageTicks / organism.maxAgeTicks : 0;
    if (ageRatio > organism.traits.fertility.urgencyAge) {
      score += 300;
    }
  }

  return score;
}

function moodScore(action: ActionDef, organism: Organism, context: DecisionContext): number {
  let score = 0;
  const mood = context.mood;

  if (mood === Mood.HAPPY) {
    if (action.type === 'reproduce' || action.type === 'seek_mate') {
      const fertilityBonus = (130 - organism.traits.fertility.energyThreshold) / 80;
      score += 150 + fertilityBonus * 50;
    }
    if (action.type === 'build_farm') {
      score += 80;
    }
  }
  if (mood === Mood.CONTENT) {
    if (action.type === 'talk' || action.type === 'share' || action.type === 'heal') {
      score += 60;
    }
  }
  if (mood === Mood.FRUSTRATED) {
    if (action.tags.has(ActionTag.COMBAT)) {
      score += 80;
    }
  }

  return score;
}

function situationalScore(action: ActionDef, organism: Organism, context: DecisionContext): number {
  let score = 0;

  if (context.underAttack && action.tags.has(ActionTag.COMBAT)) {
    score += 500;
  }
  if (action.type === 'attack') {
    const enemies = context.nearbyAgents.filter(n => n.isEnemy);
    if (enemies.length > 0) score += 150;
    const bestAlly = context.nearbyAgents
      .filter(n => n.sameFaction)
      .reduce((best, n) => n.relationship > best ? n.relationship : best, 0);
    score -= bestAlly * 200;
  }
  if (action.type === 'harvest') {
    const adjResources = context.nearbyResources.filter(r => r.dist <= 1);
    if (adjResources.length > 0) score += 80;
  }
  if (action.type === 'deposit' && context.nearOwnFlag && organism.inventory.total() >= 3) {
    score += 100;
  }
  if (action.type === 'seek_mate') {
    const seekPartners = context.nearbyAgents.filter(
      n => n.dist > 1 && n.relationship >= 0.4 && !n.agent.diseased
    );
    if (seekPartners.length > 0) score += 150;
  }
  if (action.type === 'reproduce') {
    const adjPartners = context.nearbyAgents.filter(
      n => n.dist === 1 && n.relationship >= 0.4 && !n.agent.diseased
    );
    if (adjPartners.length > 0) score += 200;
  }
  if (action.type === 'pickup') {
    const loot = context.nearbyBlocks.filter(b => b.type === 'lootBag' && b.dist <= 1);
    if (loot.length > 0) score += 80;
  }
  if (action.type === 'clean') {
    const poop = context.nearbyBlocks.filter(b => b.type === 'poop' && b.dist <= 1);
    if (poop.length > 0) score += 40;
  }

  return score;
}
