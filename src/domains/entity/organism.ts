import type { IPosition } from '../../core/types';
import { TICK_MS, LEVEL_CAP } from '../../core/constants';
import { TUNE } from '../../core/tuning';
import type { Genome, TraitSet } from '../genetics';
import type { IActionState } from '../action/types';
import { PhenotypeClass, LifecycleStage } from '../phenotype/types';
import { classify, hasHygiene as phenotypeHasHygiene, usesSimplifiedTick as phenotypeUsesSimplifiedTick } from '../phenotype/phenotype-classifier';
import { pickIdleEmoji } from '../phenotype/moveset-registry';
import { getLifecycleStage, getCurrentEmoji } from '../phenotype/lifecycle';
import type { ActionType } from '../action/types';
import { NeedSet } from './components/needs';
import { Inventory } from './components/inventory';
import { RelationshipMap } from './components/relationships';
import { PregnancyState } from './components/pregnancy';
import { ResourceMemory } from './components/memory';
import type { OrganismOpts } from './types';
import { passiveEnergyDrainPerTick, maxHpAdjustment } from '../genetics/cost-functions';

export class Organism {
  readonly id: string;
  readonly genome: Genome;
  readonly traits: TraitSet;
  readonly familyName: string;
  readonly phenotype: PhenotypeClass;
  readonly baseIdleEmoji: string;
  readonly hasHygiene: boolean;

  // Components
  readonly needs: NeedSet;
  readonly inventory: Inventory;
  readonly relationships: RelationshipMap;
  readonly pregnancy: PregnancyState | null;
  readonly memory: ResourceMemory;

  // Stats (updated on level-up)
  maxHealth: number;
  maxEnergy: number;

  // Mutable state
  name: string;
  health: number;
  energy: number;
  level: number;
  xp: number;
  ageTicks: number;
  maxAgeTicks: number;
  juvenileTicks: number;
  factionId: string | null;
  diseased: boolean;
  lifecycleStage: LifecycleStage;
  deathCause: string | null;

  // Movement / action
  cellX: number;
  cellY: number;
  prevCellX: number;
  prevCellY: number;
  lerpT: number;
  path: IPosition[] | null;
  pathIdx: number;
  goal: IPosition | null;
  replanAtTick: number;
  action: IActionState | null;
  lockMsRemaining: number;
  matingTargetId: string | null;
  moveCredit: number;
  pathFailCount: number;

  // Lineage
  generation: number;
  parentIds: string[];

  constructor(opts: OrganismOpts) {
    this.id         = opts.id;
    this.name       = opts.name;
    this.genome     = opts.genome;
    this.traits     = opts.genome.traits;
    this.familyName = opts.familyName;

    // Phenotype locked at birth
    this.phenotype     = classify(this.traits);
    const idxSeed      = opts.id.charCodeAt(0) + opts.id.charCodeAt(opts.id.length - 1);
    this.baseIdleEmoji = pickIdleEmoji(this.phenotype, idxSeed);
    this.hasHygiene    = phenotypeHasHygiene(this.phenotype);

    // Components
    this.needs = new NeedSet({
      fullness:    opts.fullness    ?? 50,
      hygiene:     opts.hygiene     ?? 50,
      social:      opts.social      ?? 50,
      inspiration: opts.inspiration ?? 50,
    });
    this.inventory = new Inventory(
      this.traits.endurance.inventoryCapacity,
      opts.inventory,
    );
    this.relationships = new RelationshipMap(
      this.traits.charisma.relationshipSlots,
      opts.relationships,
    );
    this.pregnancy = this.traits.pregnancy.gestationMs >= TUNE.functionalMin.pregnancy
      ? new PregnancyState()
      : null;
    this.memory = new ResourceMemory(this.traits.recall.memorySlots);

    // Stats from traits
    const hpAdj    = maxHpAdjustment(this.traits);
    this.maxHealth = Math.max(1, this.traits.resilience.baseMaxHp + hpAdj);
    this.maxEnergy = this.traits.vigor.baseMaxEnergy;

    this.health = opts.health ?? this.maxHealth;
    this.energy = opts.energy ?? this.maxEnergy;
    this.level  = opts.level  ?? 1;
    this.xp     = opts.xp     ?? 0;

    if (this.level > 1) {
      this.maxHealth = Math.max(1, this.maxHealth + (this.level - 1) * this.traits.resilience.perLevel);
      this.maxEnergy = this.maxEnergy + (this.level - 1) * this.traits.vigor.perLevel;
    }

    this.ageTicks   = opts.ageTicks ?? 0;
    this.maxAgeTicks = opts.maxAgeTicks
      ?? Math.floor(this.traits.longevity.maxAgeMs / TICK_MS);
    this.juvenileTicks = Math.floor(this.traits.maturity.juvenileMs / TICK_MS);

    this.factionId    = opts.factionId ?? null;
    this.diseased     = opts.diseased  ?? false;
    this.deathCause   = null;
    this.lifecycleStage = getLifecycleStage(this.ageTicks, this.juvenileTicks, this.maxAgeTicks);

    // Movement
    this.cellX          = opts.cellX;
    this.cellY          = opts.cellY;
    this.prevCellX      = opts.cellX;
    this.prevCellY      = opts.cellY;
    this.lerpT          = 1;
    this.path           = opts.path  ?? null;
    this.pathIdx        = opts.pathIdx ?? 0;
    this.goal           = opts.goal  ?? null;
    this.replanAtTick   = opts.replanAtTick ?? 0;
    this.action         = opts.action ?? null;
    this.lockMsRemaining = opts.lockMsRemaining ?? 0;
    this.matingTargetId = opts.matingTargetId ?? null;
    this.moveCredit     = 0;
    this.pathFailCount  = 0;

    // Lineage
    this.generation = opts.generation ?? 1;
    this.parentIds  = opts.parentIds  ?? [];
  }

  // ── Computed views ────────────────────────────────────────────────

  get isImmobile(): boolean {
    return this.traits.agility.speedMult < TUNE.functionalMin.agility;
  }

  get usesSimplifiedTick(): boolean {
    return phenotypeUsesSimplifiedTick(this.phenotype);
  }

  get effectiveAttack(): number {
    const base = this.traits.strength.value + this.traits.size.value * 0.3;
    return this.pregnancy?.active ? base * 0.6 : base;
  }

  get speedMult(): number {
    const base = this.traits.agility.speedMult;
    return this.pregnancy?.active ? base * 0.7 : base;
  }

  get fullnessDecayMult(): number {
    return this.pregnancy?.active ? 1.5 : 1.0;
  }

  get currentEmoji(): string {
    const actionType = this.action?.type as ActionType | null ?? null;
    return getCurrentEmoji(this.phenotype, this.lifecycleStage, this.baseIdleEmoji, actionType);
  }

  get isDead(): boolean {
    return this.health <= 0;
  }

  // ── Mutation methods ──────────────────────────────────────────────

  takeDamage(amount: number): void {
    this.health -= amount;
  }

  healBy(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  drainEnergy(amount: number): void {
    this.energy = Math.max(0, this.energy - amount);
  }

  addEnergy(amount: number): void {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  drainFullness(amount: number): void {
    this.needs.fullness = Math.max(0, this.needs.fullness - amount);
  }

  addFullness(amount: number): void {
    this.needs.fullness = Math.min(100, this.needs.fullness + amount);
  }

  addXp(amount: number): void {
    this.xp += amount;
  }

  xpToNextLevel(): number {
    return this.level * this.traits.aptitude.xpPerLevel;
  }

  canLevelUp(): boolean {
    return this.xp >= this.xpToNextLevel() && this.level < LEVEL_CAP;
  }

  levelUp(): void {
    if (this.level >= LEVEL_CAP) return;
    this.xp -= this.xpToNextLevel();
    this.level++;
    this.maxHealth += this.traits.resilience.perLevel;
    this.maxEnergy += this.traits.vigor.perLevel;
  }

  clampStats(): void {
    if (this.energy > this.maxEnergy) this.energy = this.maxEnergy;
    if (this.energy < 0) this.energy = 0;
    this.needs.clamp();
  }
}
