import { key, manhattan, log } from '../../../core/utils';
import { TUNE } from '../../../core/tuning';
import type { Agent } from '../../entity/agent';
import type { World } from '../../world/world';
import { AgentFactory } from '../../entity/agent-factory';
import { FactionManager } from '../../faction/faction-manager';
import { crossover } from '../../genetics/crossover';
import { mutate } from '../../genetics/mutation';
import { Genome } from '../../genetics/genome';
import { isViable } from '../../genetics/viability';

export function onReproduceComplete(world: World, agent: Agent, target: Agent | undefined): void {
  // Asexual reproduction (parthenogenesis)
  if (agent.traits.parthenogenesis.canSelfReproduce && !target) {
    reproduceAsexual(world, agent);
    return;
  }

  if (!target || target.health <= 0) return;
  if (manhattan(agent.cellX, agent.cellY, target.cellX, target.cellY) !== 1) return;

  // Energy costs paid up front by both parents
  agent.drainEnergy(TUNE.reproduce.energyCost);
  target.drainEnergy(TUNE.reproduce.energyCost);

  // DNA: crossover then mutate, using average Volatility of both parents
  const mutationRate = (agent.traits.volatility.mutationRate + target.traits.volatility.mutationRate) / 2;
  const childDna = mutate(crossover(agent.genome.dna, target.genome.dna), mutationRate);

  const childGenome = new Genome(childDna);
  if (!isViable(childGenome.traits, childGenome.genes, childGenome.dna)) {
    log(world, 'reproduce', `${agent.name} had a stillborn child`, agent.id, {});
    world.events.emit('agent:stillborn', { parentId: agent.id });
    return;
  }

  const familyName = agent.familyName;
  const factionId = resolveFactionId(agent, target);
  const hasAG = agent.genome.hasGeneCode('AG');
  const gestationMs = agent.traits.pregnancy.gestationMs;

  if (hasAG && gestationMs > 0) {
    // v4.2 path: gradual need-transfer gestation
    agent.pregnancy.start({
      childDna,
      childFamilyName: familyName,
      childFactionId: factionId,
      partnerId: target.id,
      useTransferMechanic: true,
      transferRate: TUNE.pregnancy.needTransferRate,
      gestationStartTick: world.tick,
    });
    world.events.emit('pregnancy:started', { agentId: agent.id });
    log(world, 'reproduce', `${agent.name} & ${target.name} are expecting`, agent.id, { targetId: target.id });

  } else if (hasAG && gestationMs <= 0) {
    // AG gene present but zero expression: instant birth, all child needs at zero.
    // Child must be fed immediately or it will die of starvation.
    instantBirth(world, agent, childDna, familyName, factionId, target.id);

  } else {
    // v4 fallback: countdown timer with fullness donation from both parents
    const [donateMin, donateMax] = TUNE.pregnancy.v4FullnessDonateRange;
    const p1Donate = Math.min(agent.fullness, donateMin + Math.random() * (donateMax - donateMin));
    const p2Donate = Math.min(target.fullness, donateMin + Math.random() * (donateMax - donateMin));
    agent.drainFullness(p1Donate);
    target.drainFullness(p2Donate);

    const babyDuration = childGenome.traits.maturity.babyDurationMs;
    agent.pregnancy.start({
      childDna,
      childFamilyName: familyName,
      childFactionId: factionId,
      partnerId: target.id,
      useTransferMechanic: false,
      donatedFullness: p1Donate + p2Donate,
      remainingMs: babyDuration * TUNE.pregnancy.v4DurationMult,
    });
    world.events.emit('pregnancy:started', { agentId: agent.id, duration: babyDuration * TUNE.pregnancy.v4DurationMult });
    log(world, 'reproduce', `${agent.name} & ${target.name} are expecting`, agent.id, { targetId: target.id });
  }
}

function reproduceAsexual(world: World, agent: Agent): void {
  agent.drainEnergy(TUNE.reproduce.energyCost);

  // Asexual: mutation rate from agent's own Volatility
  const childDna = mutate(agent.genome.dna, agent.traits.volatility.mutationRate);
  const childGenome = new Genome(childDna);
  if (!isViable(childGenome.traits, childGenome.genes, childGenome.dna)) {
    log(world, 'reproduce', `${agent.name} had a stillborn child`, agent.id, {});
    world.events.emit('agent:stillborn', { parentId: agent.id });
    return;
  }

  const factionId = agent.factionId;
  const hasAG = agent.genome.hasGeneCode('AG');
  const gestationMs = agent.traits.pregnancy.gestationMs;

  if (hasAG && gestationMs > 0) {
    agent.pregnancy.start({
      childDna,
      childFamilyName: agent.familyName,
      childFactionId: factionId,
      partnerId: null,
      useTransferMechanic: true,
      transferRate: TUNE.pregnancy.needTransferRate,
      gestationStartTick: world.tick,
    });
    world.events.emit('pregnancy:started', { agentId: agent.id });
    log(world, 'reproduce', `${agent.name} is expecting (asexual)`, agent.id, {});

  } else if (hasAG && gestationMs <= 0) {
    instantBirth(world, agent, childDna, agent.familyName, factionId, null);

  } else {
    // v4 fallback
    const [donateMin, donateMax] = TUNE.pregnancy.v4FullnessDonateRange;
    const p1Donate = Math.min(agent.fullness, donateMin + Math.random() * (donateMax - donateMin));
    agent.drainFullness(p1Donate);

    const babyDuration = childGenome.traits.maturity.babyDurationMs;
    agent.pregnancy.start({
      childDna,
      childFamilyName: agent.familyName,
      childFactionId: factionId,
      partnerId: null,
      useTransferMechanic: false,
      donatedFullness: p1Donate,
      remainingMs: babyDuration * TUNE.pregnancy.v4DurationMult,
    });
    world.events.emit('pregnancy:started', { agentId: agent.id, duration: babyDuration * TUNE.pregnancy.v4DurationMult });
    log(world, 'reproduce', `${agent.name} is expecting (asexual)`, agent.id, {});
  }
}

/**
 * AG gene present but gestationMs = 0: child is born immediately with all
 * needs at zero. It must be fed immediately or it will die.
 */
function instantBirth(
  world: World,
  parent: Agent,
  childDna: string,
  familyName: string,
  factionId: string | null,
  partnerId: string | null
): void {
  const spots: [number, number][] = [
    [parent.cellX + 1, parent.cellY],
    [parent.cellX - 1, parent.cellY],
    [parent.cellX, parent.cellY + 1],
    [parent.cellX, parent.cellY - 1],
  ];
  const free = spots.find(([x, y]) => !world.grid.isBlocked(x, y));
  if (!free) return;

  const [cx, cy] = free;
  const child = AgentFactory.createChild(cx, cy, childDna, familyName, factionId, parent.generation, 0);

  // All needs at zero — must be fed or it dies
  child.needs.fullness    = 0;
  child.needs.hygiene     = 0;
  child.needs.social      = 0;
  child.needs.inspiration = 0;

  child.parentIds = [parent.id];
  if (partnerId) child.parentIds.push(partnerId);

  world.agents.push(child);
  world.agentsById.set(child.id, child);
  world.agentsByCell.set(key(cx, cy), child.id);
  world.totalBirths++;
  world.birthTimestamps.push(performance.now());
  world.familyRegistry.registerBirth(child.familyName, child.generation);

  const parentBond = 0.8;
  child.relationships.set(parent.id, parentBond);
  parent.relationships.adjust(child.id, parentBond);
  if (partnerId) {
    const partner = world.agentsById.get(partnerId);
    if (partner) {
      child.relationships.set(partnerId, parentBond);
      partner.relationships.adjust(child.id, parentBond);
    }
  }

  if (child.factionId) {
    const faction = world.factions.get(child.factionId);
    if (faction) faction.members.add(child.id);
  }

  world.events.emit('agent:born', { child, parent1Id: parent.id, parent2Id: partnerId });
  log(world, 'reproduce', `${parent.name} gave birth to ${child.name} ${child.familyName} (instant)`, parent.id, { childId: child.id });
}

function resolveFactionId(agent: Agent, partner: Agent): string | null {
  const pa = agent.factionId || null;
  const pb = partner.factionId || null;
  if (pa && pb) return Math.random() < 0.5 ? pa : pb;
  return pa || pb;
}
