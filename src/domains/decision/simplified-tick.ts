import { TUNE } from '../../core/tuning';
import type { EventBus } from '../../core/event-bus';
import type { Organism } from '../entity/organism';
import type { OrganismFactory } from '../entity/organism-factory';
import type { World } from '../world/world';
import { LifecycleStage } from '../phenotype/types';
import { getLifecycleStage } from '../phenotype/lifecycle';

/**
 * Simplified tick for immobile organisms (plants, fungi, sessile predators).
 * No decision engine, no pathfinding — dramatically cheaper per tick.
 */
export class SimplifiedTick {
  constructor(
    private readonly bus: EventBus,
    private readonly organismFactory: OrganismFactory,
  ) {}

  process(organism: Organism, world: World, tickMs: number): void {
    // 1. Photosynthesis
    if (organism.traits.photosynthesis.value >= TUNE.functionalMin.photosynthesis) {
      this.applyPhotosynthesis(organism, world, tickMs);
    }

    // 2. Passive regeneration
    if (organism.traits.regeneration.hpPerTick > 0) {
      organism.healBy(organism.traits.regeneration.hpPerTick * (tickMs / 1000));
    }

    // 3. Asexual reproduction
    if (this.shouldReproduce(organism)) {
      this.attemptDispersal(organism, world);
    }

    // 4. Sessile reactive attack (if Strength above minimum)
    if (organism.traits.strength.value > TUNE.functionalMin.strength) {
      this.tryReactiveAttack(organism, world);
    }

    // 5. Lifecycle stage update
    this.updateLifecycleStage(organism);
  }

  private applyPhotosynthesis(organism: Organism, world: World, tickMs: number): void {
    const base = organism.traits.photosynthesis.value * TUNE.photosynthesis.baseRatePerUnit;
    const waterDist  = world.waterField.distanceAt(organism.cellX, organism.cellY);
    const proximityMult = waterDist <= TUNE.photosynthesis.waterProximityRadius
      ? TUNE.photosynthesis.waterProximityBoost
      : TUNE.photosynthesis.droughtPenalty;

    const energyGain = base * proximityMult * (tickMs / 1000);
    organism.addEnergy(energyGain);
    organism.addFullness(energyGain * 0.5);
  }

  private shouldReproduce(organism: Organism): boolean {
    return (
      organism.lifecycleStage === LifecycleStage.Adult &&
      organism.energy >= organism.traits.fertility.energyThreshold &&
      (organism.traits.parthenogenesis.canSelfReproduce || true) && // plants are always asexual
      Math.random() < 0.02
    );
  }

  private attemptDispersal(organism: Organism, world: World): void {
    const dx = Math.floor(Math.random() * 5) - 2;
    const dy = Math.floor(Math.random() * 5) - 2;
    const tx = organism.cellX + dx;
    const ty = organism.cellY + dy;

    if (!world.grid.isInBounds(tx, ty)) return;
    if (world.grid.isOccupied(tx, ty) || world.grid.isBlocked(tx, ty)) return;

    const child = this.organismFactory.createFromSeed(organism, tx, ty);
    if (child) {
      world.addOrganism(child);
      organism.drainEnergy(organism.traits.fertility.energyThreshold * 0.3);
    }
  }

  private tryReactiveAttack(organism: Organism, world: World): void {
    const adjacents = [
      { x: organism.cellX + 1, y: organism.cellY },
      { x: organism.cellX - 1, y: organism.cellY },
      { x: organism.cellX,     y: organism.cellY + 1 },
      { x: organism.cellX,     y: organism.cellY - 1 },
    ];
    for (const pos of adjacents) {
      if (!world.grid.isInBounds(pos.x, pos.y)) continue;
      const targetId = world.grid.organismsByCell.get(`${pos.x},${pos.y}`);
      if (!targetId) continue;
      const target = world.organismsById.get(targetId);
      if (!target || target.id === organism.id) continue;
      const damage = organism.effectiveAttack * 0.4;
      target.takeDamage(damage);
      this.bus.emit('combat:attack', { attackerId: organism.id, targetId: target.id, damage });
      break;
    }
  }

  private updateLifecycleStage(organism: Organism): void {
    const newStage = getLifecycleStage(organism.ageTicks, organism.juvenileTicks, organism.maxAgeTicks);
    if (newStage !== organism.lifecycleStage) {
      organism.lifecycleStage = newStage;
    }
  }
}
