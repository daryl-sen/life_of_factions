import { key, manhattan } from '../../core/utils';
import type { Organism } from '../entity/organism';
import type { World } from '../world/world';
import { evaluateNeeds } from './need-evaluator';
import { computeMood } from './mood-evaluator';
import type { DecisionContext, NearbyAgent, NearbyResource, NearbyBlock } from './types';

const DEFAULT_VISION_RANGE = 10;

export class ContextBuilder {
  static build(world: World, organism: Organism): DecisionContext {
    const vr = DEFAULT_VISION_RANGE;
    const nearbyAgents: NearbyAgent[] = [];
    const nearbyResources: NearbyResource[] = [];
    const nearbyBlocks: NearbyBlock[] = [];

    // Scan for nearby organisms
    for (const other of world.organisms) {
      if (other.id === organism.id || other.health <= 0) continue;
      const dist = manhattan(organism.cellX, organism.cellY, other.cellX, other.cellY);
      if (dist > vr) continue;
      nearbyAgents.push({
        agent: other,
        dist,
        relationship: organism.relationships.get(other.id),
        sameFaction: !!(organism.factionId && organism.factionId === other.factionId),
        isEnemy: !!(organism.factionId && other.factionId && organism.factionId !== other.factionId),
      });
    }

    // Scan for nearby food blocks
    for (const [, block] of world.grid.foodBlocks) {
      const dist = manhattan(organism.cellX, organism.cellY, block.x, block.y);
      if (dist <= vr) {
        nearbyResources.push({ type: 'plantFood', pos: { x: block.x, y: block.y }, dist });
      }
    }

    // Scan for nearby water blocks
    for (const [, block] of world.grid.waterBlocks) {
      const dist = manhattan(organism.cellX, organism.cellY, block.x, block.y);
      if (dist <= vr) {
        nearbyResources.push({ type: 'water', pos: { x: block.x, y: block.y }, dist });
      }
    }

    // Scan for corpse blocks (meat/plant food sources)
    for (const [, block] of world.grid.corpseBlocks) {
      const dist = manhattan(organism.cellX, organism.cellY, block.x, block.y);
      if (dist <= vr) {
        nearbyResources.push({ type: block.foodType === 'meat' ? 'meatFood' : 'plantFood', pos: { x: block.x, y: block.y }, dist });
      }
    }

    // Nearby poop blocks
    for (const [, block] of world.grid.poopBlocks) {
      const dist = manhattan(organism.cellX, organism.cellY, block.x, block.y);
      if (dist <= vr) {
        nearbyBlocks.push({ type: 'poop', pos: { x: block.x, y: block.y }, dist });
      }
    }

    // Nearby loot bags
    for (const [, bag] of world.grid.lootBags) {
      const dist = manhattan(organism.cellX, organism.cellY, bag.x, bag.y);
      if (dist <= vr) {
        nearbyBlocks.push({ type: 'lootBag', pos: { x: bag.x, y: bag.y }, dist });
      }
    }

    // Own faction flag
    let nearOwnFlag = false;
    let ownFlagPos = null;
    if (organism.factionId) {
      const flag = world.grid.flags.get(organism.factionId);
      if (flag) {
        ownFlagPos = { x: flag.x, y: flag.y };
        nearOwnFlag = manhattan(organism.cellX, organism.cellY, flag.x, flag.y) <= 4;
      }
    }

    const needBands = evaluateNeeds(organism);

    return {
      agent: organism,
      nearbyAgents,
      nearbyResources,
      nearbyBlocks,
      needBands,
      underAttack: false,
      pregnant: organism.pregnancy?.active ?? false,
      nearOwnFlag,
      ownFlagPos,
      mood: computeMood(needBands),
    };
  }
}
