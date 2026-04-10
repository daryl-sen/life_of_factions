import { manhattan, log } from '../../../core/utils';
import type { Organism } from '../../entity/organism';
import type { World } from '../../world/world';
import { crossover } from '../../genetics/crossover';
import { mutate } from '../../genetics/mutation';
import { Genome } from '../../genetics/genome';
import { isViable } from '../../genetics/viability';

// ── Constants ──
const REPRODUCE_ENERGY_COST = 12;
const FULLNESS_DONATE_RANGE: [number, number] = [15, 25];

export function onReproduceComplete(world: World, organism: Organism, target: Organism | undefined): void {
  if (!organism.pregnancy) return; // No pregnancy trait

  // Asexual reproduction (parthenogenesis)
  if (organism.traits.parthenogenesis.canSelfReproduce && !target) {
    reproduceAsexual(world, organism);
    return;
  }

  if (!target || target.health <= 0) return;
  if (manhattan(organism.cellX, organism.cellY, target.cellX, target.cellY) !== 1) return;

  // Energy + fullness costs
  organism.drainEnergy(REPRODUCE_ENERGY_COST);
  target.drainEnergy(REPRODUCE_ENERGY_COST);

  const rndDonate = (): number =>
    FULLNESS_DONATE_RANGE[0] + Math.random() * (FULLNESS_DONATE_RANGE[1] - FULLNESS_DONATE_RANGE[0]);

  const p1Donate = Math.min(organism.needs.fullness, rndDonate());
  const p2Donate = Math.min(target.needs.fullness, rndDonate());
  organism.drainFullness(p1Donate);
  target.drainFullness(p2Donate);

  // DNA: crossover then mutate
  const rate     = (organism.traits.volatility.mutationRate + target.traits.volatility.mutationRate) / 2;
  const childDna = mutate(crossover(organism.genome.dna, target.genome.dna), rate);

  // Check viability
  const childGenome = new Genome(childDna);
  if (!isViable(childGenome.traits, childDna)) {
    log(world, 'reproduce', `${organism.name} had a stillborn child`, organism.id, {});
    world.events.emit('organism:stillborn', { parentId: organism.id });
    return;
  }

  // Faction: inherit from initiator, or 50/50 if both have factions
  const pa = organism.factionId || null;
  const pb = target.factionId || null;
  let factionId: string | null = null;
  if (pa && pb) factionId = Math.random() < 0.5 ? pa : pb;
  else factionId = pa || pb;

  organism.pregnancy.start({
    childDna,
    childFamilyName: organism.familyName,
    childFactionId: factionId,
    partnerId: target.id,
    transferRate: organism.traits.metabolism.fullnessDecay,
    startTick: world.tick,
  });

  world.events.emit('pregnancy:started', { agentId: organism.id });
  log(world, 'reproduce', `${organism.name} & ${target.name} are expecting`, organism.id, { targetId: target.id });
}

function reproduceAsexual(world: World, organism: Organism): void {
  if (!organism.pregnancy) return;

  organism.drainEnergy(REPRODUCE_ENERGY_COST);
  const rndDonate = (): number =>
    FULLNESS_DONATE_RANGE[0] + Math.random() * (FULLNESS_DONATE_RANGE[1] - FULLNESS_DONATE_RANGE[0]);
  const p1Donate = Math.min(organism.needs.fullness, rndDonate());
  organism.drainFullness(p1Donate);

  const rate     = organism.traits.volatility.mutationRate;
  const childDna = mutate(organism.genome.dna, rate);
  const childGenome = new Genome(childDna);
  if (!isViable(childGenome.traits, childDna)) {
    log(world, 'reproduce', `${organism.name} had a stillborn child`, organism.id, {});
    world.events.emit('organism:stillborn', { parentId: organism.id });
    return;
  }

  organism.pregnancy.start({
    childDna,
    childFamilyName: organism.familyName,
    childFactionId: organism.factionId,
    partnerId: null,
    transferRate: organism.traits.metabolism.fullnessDecay,
    startTick: world.tick,
  });

  world.events.emit('pregnancy:started', { agentId: organism.id });
  log(world, 'reproduce', `${organism.name} is expecting (asexual)`, organism.id, {});
}
