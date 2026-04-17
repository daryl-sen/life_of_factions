import type { IPosition } from '../../core/types';
import type { Agent } from '../entity/agent';
import type { ActionType } from '../action/types';
import type { NeedBand, Mood } from '../entity/types';

export interface NearbyAgent {
  readonly agent: Agent;
  readonly dist: number;
  readonly relationship: number;
  readonly sameFaction: boolean;
  readonly isEnemy: boolean;
}

export interface NearbyResource {
  readonly type: 'food' | 'water' | 'wood' | 'seedling' | 'medicine' | 'cactus';
  readonly pos: IPosition;
  readonly dist: number;
}

export interface NearbyBlock {
  readonly type: 'poop' | 'lootBag' | 'flag' | 'farm' | 'obstacle' | 'tree' | 'house';
  readonly pos: IPosition;
  readonly dist: number;
  readonly id?: string;
}

export interface DecisionContext {
  readonly agent: Agent;
  readonly nearbyAgents: NearbyAgent[];
  readonly nearbyResources: NearbyResource[];
  readonly nearbyBlocks: NearbyBlock[];
  readonly needBands: Record<string, NeedBand>;
  readonly underAttack: boolean;
  readonly pregnant: boolean;
  readonly nearOwnFlag: boolean;
  readonly ownFlagPos: IPosition | null;
  readonly mood: Mood;
  /** Agent is currently within their own faction's territory radius */
  readonly inOwnTerritory: boolean;
  /** Agent is currently inside another faction's territory radius */
  readonly inEnemyTerritory: boolean;
  /** The faction ID whose territory the agent is encroaching on, if any */
  readonly enemyTerritoryFactionId: string | null;
  /** Houses within vision range */
  readonly nearbyHouses: NearbyBlock[];
  /** Agent has access to a nearby house with capacity */
  readonly hasAccessibleHouse: boolean;
  /** Agent is currently inside a house or farm */
  readonly isInsideHouse: boolean;
}

export interface ActionCandidate {
  readonly actionType: ActionType;
  readonly targetId?: string;
  readonly targetPos?: IPosition;
  readonly resourceType?: string;
  readonly score: number;
}
