import { TUNE } from './constants.js';
import { generatePronounceableString, key } from './utils.js';

export function addAgentAt(world, x, y) {
  const id = crypto.randomUUID();
  const rp = Math.random();
  const pref = rp < 1 / 3 ? "near" : rp < 2 / 3 ? "far" : "wander";
  const a = {
    id,
    name: generatePronounceableString(6),
    cellX: x,
    cellY: y,
    health: 100,
    maxHealth: 100,
    energy: 100,
    attack: TUNE.baseDamage,
    level: 1,
    ageTicks: 0,
    factionId: null,
    relationships: new Map(),
    path: null,
    pathIdx: 0,
    action: null,
    lockMsRemaining: 0,
    travelPref: pref,
    aggression: Math.random(),
    cooperation: Math.random(),
    replanAtTick: 0,
    goal: null,
  };
  world.agents.push(a);
  world.agentsById.set(id, a);
  world.agentsByCell.set(key(x, y), id);
  return a;
}
