import { uuid, generatePronounceableString } from '../../core/utils';
import { Genome, mutate, crossover, isViable } from '../genetics';
import type { EventBus } from '../../core/event-bus';
import { Organism } from './organism';

export class OrganismFactory {
  constructor(private bus: EventBus) {}

  /** Create a new organism from scratch (random or provided DNA) */
  create(opts: { dna?: string; cellX: number; cellY: number; familyName?: string }): Organism | null {
    const genome = opts.dna ? new Genome(opts.dna) : Genome.random();
    if (!isViable(genome.traits, genome.dna)) {
      this.bus.emit('organism:stillborn', { parentId: null });
      return null;
    }
    const name = generatePronounceableString(6);
    return new Organism({
      id: uuid(), name,
      cellX: opts.cellX, cellY: opts.cellY,
      genome,
      familyName: opts.familyName ?? name,
    });
  }

  /** Create a child from two parents (sexual reproduction) */
  createChild(
    parentA: Organism,
    parentB: Organism | null,
    cellX: number,
    cellY: number,
  ): Organism | null {
    const rate = parentB
      ? (parentA.traits.volatility.mutationRate + parentB.traits.volatility.mutationRate) / 2
      : parentA.traits.volatility.mutationRate;

    const childDna = parentB
      ? mutate(crossover(parentA.genome.dna, parentB.genome.dna), rate)
      : mutate(parentA.genome.dna, rate);

    return this.createFromDna(childDna, parentA.familyName, parentA.factionId, cellX, cellY, parentA.generation, [parentA.id, parentB?.id].filter((id): id is string => !!id));
  }

  /** Create an asexual offspring (seed/spore) from a single parent */
  createFromSeed(parent: Organism, cellX: number, cellY: number): Organism | null {
    const rate     = parent.traits.volatility.mutationRate;
    const childDna = mutate(parent.genome.dna, rate);
    return this.createFromDna(childDna, parent.familyName, parent.factionId, cellX, cellY, parent.generation, [parent.id]);
  }

  /** Create a child organism from already-generated DNA (used by pregnancy birth) */
  createFromDna(
    childDna: string,
    familyName: string,
    factionId: string | null,
    cellX: number,
    cellY: number,
    parentGeneration: number = 1,
    parentIds: string[] = [],
  ): Organism | null {
    const genome = new Genome(childDna);
    if (!isViable(genome.traits, genome.dna)) {
      this.bus.emit('organism:stillborn', { parentId: parentIds[0] ?? null });
      return null;
    }
    const name = generatePronounceableString(6);
    const organism = new Organism({
      id: uuid(), name,
      cellX, cellY,
      genome,
      familyName,
      factionId,
      fullness: 50, energy: 50,
      generation: parentGeneration + 1,
      parentIds,
    });
    this.bus.emit('organism:born', { childId: organism.id, parentIds });
    return organism;
  }
}
