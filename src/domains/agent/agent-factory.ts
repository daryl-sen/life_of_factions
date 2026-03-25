import { TUNE } from '../../shared/constants';
import { generatePronounceableString, uuid, key, clamp } from '../../shared/utils';
import type { TravelPref } from '../../shared/types';
import type { World } from '../world';
import { Agent } from './agent';

export class AgentFactory {
  static create(world: World, x: number, y: number): Agent {
    const rp = Math.random();
    const pref: TravelPref = rp < 1 / 3 ? 'near' : rp < 2 / 3 ? 'far' : 'wander';
    const agent = new Agent({
      id: uuid(),
      name: generatePronounceableString(6),
      cellX: x,
      cellY: y,
      travelPref: pref,
      aggression: Math.random(),
      cooperation: Math.random(),
    });
    world.agents.push(agent);
    world.agentsById.set(agent.id, agent);
    world.agentsByCell.set(key(x, y), agent.id);
    return agent;
  }

  static createChild(
    world: World,
    parent1: Agent,
    parent2: Agent,
    x: number,
    y: number
  ): Agent {
    const child = new Agent({
      id: uuid(),
      name: generatePronounceableString(6),
      cellX: x,
      cellY: y,
      energy: 60,
      health: 80,
      aggression: clamp((parent1.aggression + parent2.aggression) / 2, 0, 1),
      cooperation: clamp((parent1.cooperation + parent2.cooperation) / 2, 0, 1),
      travelPref: Math.random() < 0.5 ? parent1.travelPref : parent2.travelPref,
    });
    world.agents.push(child);
    world.agentsById.set(child.id, child);
    world.agentsByCell.set(key(x, y), child.id);
    return child;
  }
}
