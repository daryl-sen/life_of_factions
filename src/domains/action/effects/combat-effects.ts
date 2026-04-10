import { log } from '../../../core/utils';
import type { Organism } from '../../entity/organism';
import type { World } from '../../world/world';
import { LifecycleStage } from '../../phenotype/types';

const XP_PER_KILL = 50;

export function onAttackTick(world: World, organism: Organism, target: Organism): void {
  const elderMult = organism.lifecycleStage === LifecycleStage.Elder ? 0.7 : 1.0;
  const damage    = organism.effectiveAttack * 0.4 * elderMult;

  target.takeDamage(damage);

  // Same-faction attack: 30% chance target leaves faction
  if (organism.factionId && organism.factionId === target.factionId) {
    if (Math.random() < 0.3) {
      target.factionId = null;
    }
  }

  organism.relationships.adjust(target.id, -0.2);
  log(world, 'attack', `${organism.name} hit ${target.name}`, organism.id, { to: target.id });

  if (target.health <= 0) {
    organism.addXp(XP_PER_KILL);
    checkLevelUp(world, organism);
  }
}

export function onAttackComplete(_world: World, _organism: Organism, _target: Organism | undefined): void {
  // Attack completion has no special effect beyond periodic damage
}

function checkLevelUp(world: World, organism: Organism): void {
  while (organism.canLevelUp()) {
    organism.levelUp();
    log(world, 'level', `${organism.name} leveled to ${organism.level}`, organism.id, {});
  }
}
