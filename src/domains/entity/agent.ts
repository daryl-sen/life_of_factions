import type { IPosition, IInventory, ResourceMemoryType, IResourceMemoryEntry } from '../../core/types';
import { TICK_MS, LEVEL_CAP } from '../../core/constants';
import type { Genome, TraitSet } from '../genetics';
import type { IActionState } from '../action/types';
import type { AgentOpts, EntityClassName } from './types';
import { NeedSet } from './components/needs';
import { Inventory } from './components/inventory';
import { RelationshipMap } from './components/relationships';
import { PregnancyState } from './components/pregnancy';

export class Agent {
  readonly id: string;
  readonly genome: Genome;
  readonly traits: TraitSet;
  readonly familyName: string;

  // Components
  readonly needs: NeedSet;
  readonly inventory: Inventory;
  readonly relationships: RelationshipMap;
  readonly pregnancy: PregnancyState;

  // Derived from traits (updated on level-up)
  maxHealth: number;
  maxEnergy: number;
  attack: number;

  // Mutable state
  name: string;
  health: number;
  energy: number;
  level: number;
  xp: number;
  ageTicks: number;
  maxAgeTicks: number;
  factionId: string | null;
  entityClass: EntityClassName;
  diseased: boolean;

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
  _underAttack: boolean;

  // Lineage
  generation: number;

  // Navigation
  pathFailCount: number;

  // Legacy fields
  poopTimerMs: number;
  babyMsRemaining: number;
  resourceMemory: Map<ResourceMemoryType, IResourceMemoryEntry[]>;

  constructor(opts: AgentOpts) {
    this.id = opts.id;
    this.name = opts.name;
    this.genome = opts.genome;
    this.traits = opts.genome.traits;
    this.familyName = opts.familyName;

    // Components
    this.needs = new NeedSet(
      opts.fullness ?? 50,
      opts.hygiene ?? 50,
      opts.social ?? 50,
      opts.inspiration ?? 50
    );
    this.inventory = new Inventory(
      this.traits.endurance.inventoryCapacity,
      opts.inventory?.food ?? 0,
      opts.inventory?.water ?? 0,
      opts.inventory?.wood ?? 0
    );
    this.relationships = new RelationshipMap(
      this.traits.charisma.relationshipSlots,
      opts.relationships
    );
    this.pregnancy = new PregnancyState();

    // Stats from genetics
    this.maxHealth = this.traits.resilience.baseMaxHp;
    this.maxEnergy = this.traits.vigor.baseMaxEnergy;
    this.attack = this.traits.strength.baseAttack;

    this.health = opts.health ?? this.maxHealth;
    this.energy = opts.energy ?? 100;
    this.level = opts.level ?? 1;
    this.xp = opts.xp ?? 0;
    this.ageTicks = opts.ageTicks ?? 0;
    this.factionId = opts.factionId ?? null;
    this.entityClass = opts.entityClass ?? 'adult';
    this.diseased = opts.diseased ?? false;

    // Calculate maxAgeTicks from genetics
    if (opts.maxAgeTicks != null) {
      this.maxAgeTicks = opts.maxAgeTicks;
    } else {
      this.maxAgeTicks = Math.floor(this.traits.longevity.maxAgeMs / TICK_MS);
    }

    // Re-apply level-ups if restoring a leveled agent
    if (this.level > 1) {
      this.maxHealth = this.traits.resilience.baseMaxHp + (this.level - 1) * this.traits.resilience.perLevel;
      this.maxEnergy = this.traits.vigor.baseMaxEnergy + (this.level - 1) * this.traits.vigor.perLevel;
      this.attack = this.traits.strength.baseAttack + (this.level - 1) * this.traits.strength.perLevel;
    }

    // Movement
    this.cellX = opts.cellX;
    this.cellY = opts.cellY;
    this.prevCellX = opts.cellX;
    this.prevCellY = opts.cellY;
    this.lerpT = 1;
    this.path = opts.path ?? null;
    this.pathIdx = opts.pathIdx ?? 0;
    this.goal = opts.goal ?? null;
    this.replanAtTick = opts.replanAtTick ?? 0;
    this.action = opts.action ?? null;
    this.lockMsRemaining = opts.lockMsRemaining ?? 0;
    this._underAttack = false;

    // Lineage
    this.generation = opts.generation ?? 1;

    // Navigation
    this.pathFailCount = 0;

    // Legacy
    this.poopTimerMs = opts.poopTimerMs ?? 0;
    this.babyMsRemaining = opts.babyMsRemaining ?? 0;
    this.resourceMemory = new Map<ResourceMemoryType, IResourceMemoryEntry[]>([
      ['food', []], ['water', []], ['wood', []],
    ]);
  }

  // ── Getter/setter compatibility layer ──
  // These delegate to components so consumer code (renderer, UI) can still
  // read/write agent.fullness, agent.hygiene, etc.

  get fullness(): number { return this.needs.fullness; }
  set fullness(v: number) { this.needs.fullness = v; }

  get hygiene(): number { return this.needs.hygiene; }
  set hygiene(v: number) { this.needs.hygiene = v; }

  get social(): number { return this.needs.social; }
  set social(v: number) { this.needs.social = v; }

  get inspiration(): number { return this.needs.inspiration; }
  set inspiration(v: number) { this.needs.inspiration = v; }

  // ── Pregnancy debuffs ──

  /** Effective attack, reduced by 40% during pregnancy */
  get effectiveAttack(): number {
    return this.pregnancy.active ? this.attack * 0.6 : this.attack;
  }

  /** Fullness decay multiplier: 1.5x during pregnancy (eating for two) */
  get fullnessDecayMult(): number {
    return this.pregnancy.active ? 1.5 : 1.0;
  }

  /** Speed multiplier: 0.7x during pregnancy */
  get speedMult(): number {
    return this.pregnancy.active ? 0.7 : 1.0;
  }

  // ── Backward-compatible trait accessors ──

  get aggression(): number { return this.traits.aggression.baseProbability; }
  get cooperation(): number { return this.traits.cooperation.baseProbability; }

  // ── Health ──

  takeDamage(amount: number): void {
    this.health -= amount;
  }

  healBy(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  get isDead(): boolean {
    return this.health <= 0;
  }

  // ── Energy ──

  drainEnergy(amount: number): void {
    this.energy = Math.max(0, this.energy - amount);
  }

  addEnergy(amount: number): void {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  // ── Fullness ──

  drainFullness(amount: number): void {
    this.needs.fullness = Math.max(0, this.needs.fullness - amount);
  }

  addFullness(amount: number): void {
    this.needs.fullness = Math.min(100, this.needs.fullness + amount);
  }

  // ── Stats ──

  clampStats(): void {
    if (this.energy < 0) this.energy = 0;
    if (this.energy > this.maxEnergy) this.energy = this.maxEnergy;
    this.needs.clamp();
  }

  // ── XP & Leveling ──

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
    this.attack += this.traits.strength.perLevel;
    this.maxEnergy += this.traits.vigor.perLevel;
  }

  // ── Inventory compatibility ──

  inventoryTotal(): number {
    return this.inventory.total();
  }

  inventoryFull(): boolean {
    return this.inventory.isFull();
  }

  addToInventory(type: keyof IInventory, amount: number): number {
    return this.inventory.add(type, amount);
  }

  removeFromInventory(type: keyof IInventory, amount: number): number {
    return this.inventory.remove(type, amount);
  }

  // ── Resource Memory ──

  rememberResource(type: ResourceMemoryType, x: number, y: number, tick: number): void {
    const entries = this.resourceMemory.get(type)!;
    const existing = entries.findIndex(e => e.x === x && e.y === y);
    if (existing >= 0) {
      entries[existing].tick = tick;
      return;
    }
    const maxSlots = this.traits.recall.memorySlots;
    if (entries.length >= maxSlots) {
      let oldestIdx = 0;
      for (let i = 1; i < entries.length; i++) {
        if (entries[i].tick < entries[oldestIdx].tick) oldestIdx = i;
      }
      entries[oldestIdx] = { x, y, tick };
    } else {
      entries.push({ x, y, tick });
    }
  }

  forgetResource(type: ResourceMemoryType, x: number, y: number): void {
    const entries = this.resourceMemory.get(type)!;
    const idx = entries.findIndex(e => e.x === x && e.y === y);
    if (idx >= 0) entries.splice(idx, 1);
  }
}
