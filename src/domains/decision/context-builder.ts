import { key, manhattan } from '../../core/utils';
import type { Agent } from '../entity/agent';
import type { World } from '../world/world';
import { evaluateNeeds } from './need-evaluator';
import { computeMood } from './mood-evaluator';
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

    // Scan for nearby medicine blocks (only relevant if diseased)
    if (agent.diseased) {
      for (const [, block] of world.grid.medicineBlocks) {
        const dist = manhattan(agent.cellX, agent.cellY, block.x, block.y);
        if (dist <= vr) {
          nearbyResources.push({ type: 'medicine', pos: { x: block.x, y: block.y }, dist });
        }
      }
    }

    // Scan for nearby cactus blocks
    for (const [, block] of world.grid.cactusBlocks) {
      const dist = manhattan(agent.cellX, agent.cellY, block.x, block.y);
      if (dist <= vr) {
        nearbyResources.push({ type: 'cactus', pos: { x: block.x, y: block.y }, dist });
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

    // Nearby houses (deduplicate multi-cell houses by id)
    const nearbyHouses: NearbyBlock[] = [];
    const seenHouseIds = new Set<string>();
    for (const [, house] of world.grid.houses) {
      if (seenHouseIds.has(house.id)) continue;
      seenHouseIds.add(house.id);
      const dist = manhattan(agent.cellX, agent.cellY, house.x, house.y);
      if (dist <= vr) {
        nearbyHouses.push({ type: 'house', pos: { x: house.x, y: house.y }, dist, id: house.id });
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

    // Territory membership
    let inOwnTerritory = false;
    let inEnemyTerritory = false;
    let enemyTerritoryFactionId: string | null = null;

    if (agent.factionId) {
      const ownFlag = world.grid.flags.get(agent.factionId);
      const ownFaction = world.factions.get(agent.factionId);
      if (ownFlag && ownFaction) {
        inOwnTerritory = manhattan(agent.cellX, agent.cellY, ownFlag.x, ownFlag.y) <= ownFaction.territoryRadius();
      }
    }

    for (const [fid, faction] of world.factions) {
      if (fid === agent.factionId) continue;
      const flag = world.grid.flags.get(fid);
      if (!flag) continue;
      if (manhattan(agent.cellX, agent.cellY, flag.x, flag.y) <= faction.territoryRadius()) {
        inEnemyTerritory = true;
        enemyTerritoryFactionId = fid;
        break;
      }
    }

    const needBands = evaluateNeeds(agent);

    // Determine if agent has access to a nearby house with room
    const hasAccessibleHouse = nearbyHouses.some(nb => {
      const house = world.grid.houses.get(key(nb.pos.x, nb.pos.y));
      if (!house) return false;
      if (house.occupantIds.length >= house.capacity) return false;
      // Access: family match or vacant
      return !house.ownerId || house.familyName === agent.familyName || house.familyName === '';
    });

    return {
      agent,
      nearbyAgents,
      nearbyResources,
      nearbyBlocks,
      needBands,
      underAttack: agent._underAttack,
      pregnant: agent.pregnancy.active,
      nearOwnFlag,
      ownFlagPos,
      mood: computeMood(needBands),
      inOwnTerritory,
      inEnemyTerritory,
      enemyTerritoryFactionId,
      nearbyHouses,
      hasAccessibleHouse,
      isInsideHouse: agent.isInsideHouse,
    };
  }
}
