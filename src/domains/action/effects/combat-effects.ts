import { log } from '../../../core/utils';
import type { Agent } from '../../entity/agent';
import type { World } from '../../world/world';

const XP_PER_KILL = 50;

export function onAttackTick(world: World, agent: Agent, target: Agent): void {
  // effectiveAttack already includes pregnancy debuff (-40%);
  // elder class gets an additional 0.7x multiplier
  const effectiveAttack = agent.entityClass === 'elder'
    ? agent.effectiveAttack * 0.7
    : agent.effectiveAttack;

  target.takeDamage(effectiveAttack * 0.4);

  // Same-faction attack: 30% chance target leaves faction, else retaliates
  if (agent.factionId && agent.factionId === target.factionId) {
    if (Math.random() < 0.3) {
      target.factionId = null;
    }
  }

  agent.relationships.adjust(target.id, -0.2);
  log(world, 'attack', `${agent.name} hit ${target.name}`, agent.id, { to: target.id });

  if (target.health <= 0) {
    agent.addXp(XP_PER_KILL);
    checkLevelUp(world, agent);
  }
}

export function onAttackComplete(_world: World, _agent: Agent, _target: Agent | undefined): void {
  // Attack completion has no special effect beyond periodic damage
}

function checkLevelUp(world: World, agent: Agent): void {
  while (agent.canLevelUp()) {
    agent.levelUp();
    log(world, 'level', `${agent.name} leveled to ${agent.level}`, agent.id, {});
  }
}
