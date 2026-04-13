import { manhattan, log } from '../../../core/utils';
import type { Agent } from '../../entity/agent';
import type { World } from '../../world/world';
import { AgentFactory } from '../../entity/agent-factory';
import { FactionManager } from '../../faction/faction-manager';
import { crossover } from '../../genetics/crossover';
import { mutate } from '../../genetics/mutation';
import { Genome } from '../../genetics/genome';
import { isViable } from '../../genetics/viability';
import { TUNE } from '../../../core/tuning';

export function onReproduceComplete(world: World, agent: Agent, target: Agent | undefined): void {
  // Asexual reproduction (parthenogenesis)
  if (agent.traits.parthenogenesis.canSelfReproduce && !target) {
    reproduceAsexual(world, agent);
    return;
  }

  if (!target || target.health <= 0) return;
  if (manhattan(agent.cellX, agent.cellY, target.cellX, target.cellY) !== 1) return;

  const spots: [number, number][] = [
    [agent.cellX + 1, agent.cellY],
    [agent.cellX - 1, agent.cellY],
    [agent.cellX, agent.cellY + 1],
    [agent.cellX, agent.cellY - 1],
  ];
  const free = spots.find(([x, y]) => !world.grid.isBlocked(x, y));
  if (!free) return;

  // Energy + fullness costs
  agent.drainEnergy(TUNE.reproduce.energyCost);
  target.drainEnergy(TUNE.reproduce.energyCost);

  const [donateMin, donateMax] = TUNE.pregnancy.v4FullnessDonateRange;
  const p1Donate = Math.min(agent.fullness, donateMin + Math.random() * (donateMax - donateMin));
  const p2Donate = Math.min(target.fullness, donateMin + Math.random() * (donateMax - donateMin));
  agent.drainFullness(p1Donate);
  target.drainFullness(p2Donate);

  // DNA: crossover then mutate (v4 path uses TUNE.mutation.baseRate)
  const childDna = mutate(crossover(agent.genome.dna, target.genome.dna));

  // Check viability
  const childGenome = new Genome(childDna);
  if (!isViable(childGenome.traits, childGenome.genes, childGenome.dna)) {
    log(world, 'reproduce', `${agent.name} had a stillborn child`, agent.id, {});
    world.events.emit('agent:stillborn', { parentId: agent.id });
    return;
  }

  // Initiator is the carrier and lineage holder
  const familyName = agent.familyName;
  const [x, y] = free;

  // Faction: inherit from initiator, or 50/50 if both have factions
  let factionId: string | null = null;
  const pa = agent.factionId || null;
  const pb = target.factionId || null;
  if (pa && pb) factionId = Math.random() < 0.5 ? pa : pb;
  else factionId = pa || pb;

  // Start pregnancy on the initiator
  const babyDuration = childGenome.traits.maturity.babyDurationMs;
  const pregnancyDuration = babyDuration * TUNE.pregnancy.v4DurationMult;
  const totalDonated = p1Donate + p2Donate;
  agent.pregnancy.start(childDna, pregnancyDuration, familyName, factionId, target.id, totalDonated);

  world.events.emit('pregnancy:started', { agentId: agent.id, duration: pregnancyDuration });
  log(world, 'reproduce', `${agent.name} & ${target.name} are expecting`, agent.id, { targetId: target.id });
}

function reproduceAsexual(world: World, agent: Agent): void {
  const spots: [number, number][] = [
    [agent.cellX + 1, agent.cellY],
    [agent.cellX - 1, agent.cellY],
    [agent.cellX, agent.cellY + 1],
    [agent.cellX, agent.cellY - 1],
  ];
  const free = spots.find(([x, y]) => !world.grid.isBlocked(x, y));
  if (!free) return;

  agent.drainEnergy(TUNE.reproduce.energyCost);
  const [donateMinA, donateMaxA] = TUNE.pregnancy.v4FullnessDonateRange;
  const p1Donate = Math.min(agent.fullness, donateMinA + Math.random() * (donateMaxA - donateMinA));
  agent.drainFullness(p1Donate);

  // No crossover, just mutate
  const childDna = mutate(agent.genome.dna);
  const childGenome = new Genome(childDna);
  if (!isViable(childGenome.traits, childGenome.genes, childGenome.dna)) {
    log(world, 'reproduce', `${agent.name} had a stillborn child`, agent.id, {});
    world.events.emit('agent:stillborn', { parentId: agent.id });
    return;
  }

  const babyDuration = childGenome.traits.maturity.babyDurationMs;
  const pregnancyDuration = babyDuration * TUNE.pregnancy.v4DurationMult;
  agent.pregnancy.start(childDna, pregnancyDuration, agent.familyName, agent.factionId, null, p1Donate);

  world.events.emit('pregnancy:started', { agentId: agent.id, duration: pregnancyDuration });
  log(world, 'reproduce', `${agent.name} is expecting (asexual)`, agent.id, {});
}
