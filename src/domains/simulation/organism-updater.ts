import { TICK_MS } from '../../core/constants';
import { TUNE } from '../../core/tuning';
import type { World } from '../world/world';
import type { Organism } from '../entity/organism';
import type { EventBus } from '../../core/event-bus';
import type { DecisionEngine } from '../decision/decision-engine';
import type { SimplifiedTick } from '../decision/simplified-tick';
import type { OrganismFactory } from '../entity/organism-factory';
import { passiveEnergyDrainPerTick } from '../genetics/cost-functions';
import { getLifecycleStage } from '../phenotype/lifecycle';

/**
 * v5 OrganismUpdater — replaces AgentUpdater.
 * Routes organisms to full decision engine (mobile) or simplified tick (immobile).
 */
export class OrganismUpdater {
  constructor(
    private readonly decisionEngine: DecisionEngine,
    private readonly simplifiedTick: SimplifiedTick,
    private readonly bus: EventBus,
    private readonly factory: OrganismFactory,
  ) {}

  update(organism: Organism, world: World, tickMs: number): void {
    // 1. Passive stat drain
    this.drainPassive(organism, tickMs);

    // 2. Age and lifecycle
    organism.ageTicks++;
    const newStage = getLifecycleStage(organism.ageTicks, organism.juvenileTicks, organism.maxAgeTicks);
    if (newStage !== organism.lifecycleStage) organism.lifecycleStage = newStage;

    // 3. Age death check
    if (organism.ageTicks >= organism.maxAgeTicks) {
      organism.deathCause = 'old_age';
      organism.health = 0;
    }

    // 4. Handle death
    if (organism.isDead) {
      this.handleDeath(organism, world);
      return;
    }

    // 5. Starvation HP drain
    if (organism.needs.fullness <= 0) {
      organism.takeDamage(1.0 * (tickMs / 1000));
      if (organism.isDead) {
        organism.deathCause = 'starvation';
        this.handleDeath(organism, world);
        return;
      }
    }

    // 6. Disease HP drain
    if (organism.diseased) {
      organism.takeDamage(0.3 * (tickMs / 1000));
      if (organism.isDead) {
        organism.deathCause = 'disease';
        this.handleDeath(organism, world);
        return;
      }
    }

    // 7. Pregnancy transfer (if applicable)
    if (organism.pregnancy?.active) {
      this.processPregnancyTransfer(organism, world);
    }

    // 8. Passive regeneration (from Regeneration trait, for all)
    if (organism.traits.regeneration.hpPerTick > 0) {
      organism.healBy(organism.traits.regeneration.hpPerTick * (tickMs / 1000));
    }

    // 9. Route to appropriate tick path
    if (organism.usesSimplifiedTick) {
      this.simplifiedTick.process(organism, world, tickMs);
    } else {
      this.decisionEngine.tick(organism, world, tickMs);
    }
  }

  private drainPassive(organism: Organism, tickMs: number): void {
    const seconds = tickMs / 1000;

    // Fullness decay from Metabolism
    organism.drainFullness(organism.traits.metabolism.fullnessDecay * seconds * organism.fullnessDecayMult);

    // Passive energy drain from cost functions
    organism.drainEnergy(passiveEnergyDrainPerTick(organism.traits) * seconds);

    // Hygiene and social decay — only animal-like organisms
    if (organism.hasHygiene) {
      organism.needs.hygiene = Math.max(0, organism.needs.hygiene - TUNE.decay.baseHygienePerTick * seconds);
    }
    if (organism.traits.sociality.value >= TUNE.functionalMin.sociality) {
      organism.needs.social = Math.max(0, organism.needs.social - TUNE.decay.baseSocialPerTick * seconds);
    }
  }

  private processPregnancyTransfer(organism: Organism, world: World): void {
    const pregnancy = organism.pregnancy!;
    const drained = pregnancy.tickTransfer();

    organism.drainFullness(drained.fullnessDrained);
    if (organism.hasHygiene) {
      organism.needs.hygiene = Math.max(0, organism.needs.hygiene - drained.hygieneDrained);
    }
    if (organism.traits.sociality.value >= TUNE.functionalMin.sociality) {
      organism.needs.social = Math.max(0, organism.needs.social - drained.socialDrained);
    }

    if (pregnancy.isReadyForBirth()) {
      const child = this.factory.createFromDna(
        pregnancy.childDna!,
        pregnancy.childFamilyName!,
        pregnancy.childFactionId,
        organism.cellX,
        organism.cellY,
        organism.generation,
        [organism.id],
      );
      if (child) world.addOrganism(child);
      pregnancy.end();
    }
  }

  private handleDeath(organism: Organism, world: World): void {
    // Spawn corpse if Harvestable
    world.blockManager.spawnCorpse(organism);

    // Drop loot bag if inventory has contents
    if (organism.inventory.total() > 0) {
      world.blockManager.spawnLootBag(organism);
    }

    // Remove from faction
    if (organism.factionId && world.factions.has(organism.factionId)) {
      world.factions.get(organism.factionId)!.members.delete(organism.id);
    }

    world.totalDeaths++;
    world.deathTimestamps.push(performance.now());

    const ageMs = organism.ageTicks * TICK_MS;
    world.familyRegistry.registerDeath(organism.familyName, ageMs);

    this.bus.emit('organism:died', {
      organismId: organism.id,
      cause: organism.deathCause ?? 'unknown',
      position: { x: organism.cellX, y: organism.cellY },
      phenotype: organism.phenotype,
    });
  }
}
