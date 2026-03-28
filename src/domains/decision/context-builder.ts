import { key, manhattan } from '../../core/utils';
import type { Agent } from '../entity/agent';
import type { World } from '../world/world';
import { NeedBand } from '../entity/types';
import { evaluateNeeds } from './need-evaluator';
import type { DecisionContext, NearbyAgent, NearbyResource, NearbyBlock } from './types';

const DEFAULT_VISION_RANGE = 10;

export class ContextBuilder {
  static build(world: World, agent: Agent): DecisionContext {
    const vr = DEFAULT_VISION_RANGE;
    const nearbyAgents: NearbyAgent[] = [];
    const nearbyResources: NearbyResource[] = [];
    const nearbyBlocks: NearbyBlock[] = [];

    // Scan for nearby agents
    for (const other of world.agents) {
      if (other.id === agent.id || other.health <= 0) continue;
      const dist = manhattan(agent.cellX, agent.cellY, other.cellX, other.cellY);
      if (dist > vr) continue;
      nearbyAgents.push({
        agent: other,
        dist,
        relationship: agent.relationships.get(other.id),
        sameFaction: !!(agent.factionId && agent.factionId === other.factionId),
        isEnemy: !!(agent.factionId && other.factionId && agent.factionId !== other.factionId),
      });
    }

    // Scan for nearby food blocks
    for (const [, block] of world.grid.foodBlocks) {
      const dist = manhattan(agent.cellX, agent.cellY, block.x, block.y);
      if (dist <= vr) {
        nearbyResources.push({ type: 'food', pos: { x: block.x, y: block.y }, dist });
      }
    }

    // Scan for nearby water blocks
    for (const [, block] of world.grid.waterBlocks) {
      const dist = manhattan(agent.cellX, agent.cellY, block.x, block.y);
      if (dist <= vr) {
        nearbyResources.push({ type: 'water', pos: { x: block.x, y: block.y }, dist });
      }
    }

    // Scan for nearby tree blocks (wood)
    for (const [, block] of world.grid.treeBlocks) {
      const dist = manhattan(agent.cellX, agent.cellY, block.x, block.y);
      if (dist <= vr) {
        nearbyResources.push({ type: 'wood', pos: { x: block.x, y: block.y }, dist });
      }
    }

    // Nearby poop blocks
    for (const [, block] of world.grid.poopBlocks) {
      const dist = manhattan(agent.cellX, agent.cellY, block.x, block.y);
      if (dist <= vr) {
        nearbyBlocks.push({ type: 'poop', pos: { x: block.x, y: block.y }, dist });
      }
    }

    // Nearby loot bags
    for (const [, bag] of world.grid.lootBags) {
      const dist = manhattan(agent.cellX, agent.cellY, bag.x, bag.y);
      if (dist <= vr) {
        nearbyBlocks.push({ type: 'lootBag', pos: { x: bag.x, y: bag.y }, dist });
      }
    }

    // Own faction flag
    let nearOwnFlag = false;
    let ownFlagPos = null;
    if (agent.factionId) {
      const flag = world.grid.flags.get(agent.factionId);
      if (flag) {
        ownFlagPos = { x: flag.x, y: flag.y };
        nearOwnFlag = manhattan(agent.cellX, agent.cellY, flag.x, flag.y) <= 4;
      }
    }

    return {
      agent,
      nearbyAgents,
      nearbyResources,
      nearbyBlocks,
      needBands: evaluateNeeds(agent),
      underAttack: agent._underAttack,
      pregnant: agent.pregnancy.active,
      nearOwnFlag,
      ownFlagPos,
    };
  }
}
