import { uuid, generatePronounceableString } from '../../core/utils';
import { Genome } from '../genetics';
import { Agent } from './agent';

export class AgentFactory {
  /** Create a new agent with random or provided genome */
  static create(
    cellX: number,
    cellY: number,
    genome?: Genome,
    familyName?: string
  ): Agent {
    const g = genome ?? Genome.random();
    const name = generatePronounceableString(6);
    const family = familyName ?? name; // First-gen: family name = first name

    return new Agent({
      id: uuid(),
      name,
      cellX,
      cellY,
      genome: g,
      familyName: family,
      entityClass: 'adult',
    });
  }

  /** Create a child agent from reproduction */
  static createChild(
    cellX: number,
    cellY: number,
    childDna: string,
    familyName: string,
    factionId: string | null,
    parentGeneration: number = 1
  ): Agent {
    const genome = new Genome(childDna);
    const name = generatePronounceableString(6);

    return new Agent({
      id: uuid(),
      name,
      cellX,
      cellY,
      genome,
      familyName,
      factionId,
      entityClass: 'baby',
      babyMsRemaining: genome.traits.maturity.babyDurationMs,
      energy: 50,
      health: genome.traits.resilience.baseMaxHp,
      generation: parentGeneration + 1,
    });
  }

  /** Create an agent from a hatching egg (random DNA, baby) */
  static createFromEgg(cellX: number, cellY: number): Agent {
    const genome = Genome.random();
    const name = generatePronounceableString(6);

    return new Agent({
      id: uuid(),
      name,
      cellX,
      cellY,
      genome,
      familyName: name, // Egg-born founds a new lineage
      entityClass: 'baby',
      babyMsRemaining: genome.traits.maturity.babyDurationMs,
      energy: 50,
    });
  }
}
