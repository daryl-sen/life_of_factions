import type { IActionState, IInventory, IPosition, TravelPref } from '../../shared/types';
import { TUNE } from '../../shared/constants';
import { RelationshipMap } from './relationships';

export class Agent {
  readonly id: string;
  name: string;
  cellX: number;
  cellY: number;
  prevCellX: number;
  prevCellY: number;
  lerpT: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  attack: number;
  level: number;
  ageTicks: number;
  factionId: string | null;
  readonly relationships: RelationshipMap;
  path: IPosition[] | null;
  pathIdx: number;
  action: IActionState | null;
  lockMsRemaining: number;
  travelPref: TravelPref;
  aggression: number;
  cooperation: number;
  replanAtTick: number;
  goal: IPosition | null;
  _underAttack: boolean;

  // Needs system
  fullness: number;
  hygiene: number;
  social: number;
  inspiration: number;
  xp: number;

  // Inventory
  inventory: IInventory;
  poopTimerMs: number;

  constructor(opts: {
    id: string;
    name: string;
    cellX: number;
    cellY: number;
    health?: number;
    maxHealth?: number;
    energy?: number;
    maxEnergy?: number;
    attack?: number;
    level?: number;
    ageTicks?: number;
    factionId?: string | null;
    relationships?: Map<string, number>;
    path?: IPosition[] | null;
    pathIdx?: number;
    action?: IActionState | null;
    lockMsRemaining?: number;
    travelPref?: TravelPref;
    aggression?: number;
    cooperation?: number;
    replanAtTick?: number;
    goal?: IPosition | null;
    fullness?: number;
    hygiene?: number;
    social?: number;
    inspiration?: number;
    xp?: number;
    inventory?: IInventory;
    poopTimerMs?: number;
  }) {
    this.id = opts.id;
    this.name = opts.name;
    this.cellX = opts.cellX;
    this.cellY = opts.cellY;
    this.prevCellX = opts.cellX;
    this.prevCellY = opts.cellY;
    this.lerpT = 1;
    this.health = opts.health ?? 100;
    this.maxHealth = opts.maxHealth ?? 100;
    this.energy = opts.energy ?? 100;
    this.maxEnergy = opts.maxEnergy ?? TUNE.maxEnergyBase;
    this.attack = opts.attack ?? TUNE.baseDamage;
    this.level = opts.level ?? 1;
    this.ageTicks = opts.ageTicks ?? 0;
    this.factionId = opts.factionId ?? null;
    this.relationships = new RelationshipMap(opts.relationships);
    this.path = opts.path ?? null;
    this.pathIdx = opts.pathIdx ?? 0;
    this.action = opts.action ?? null;
    this.lockMsRemaining = opts.lockMsRemaining ?? 0;
    this.travelPref = opts.travelPref ?? 'near';
    this.aggression = opts.aggression ?? Math.random();
    this.cooperation = opts.cooperation ?? Math.random();
    this.replanAtTick = opts.replanAtTick ?? 0;
    this.goal = opts.goal ?? null;
    this._underAttack = false;

    // Needs
    this.fullness = opts.fullness ?? TUNE.fullness.start;
    this.hygiene = opts.hygiene ?? TUNE.needs.hygieneStart;
    this.social = opts.social ?? TUNE.needs.socialStart;
    this.inspiration = opts.inspiration ?? TUNE.needs.inspirationStart;
    this.xp = opts.xp ?? 0;
    this.inventory = opts.inventory ?? { food: 0, water: 0, wood: 0 };
    this.poopTimerMs = opts.poopTimerMs ?? 0;
  }

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

  clampStats(): void {
    if (this.energy < 0) this.energy = 0;
    if (this.energy > this.maxEnergy) this.energy = this.maxEnergy;
    if (this.fullness < 0) this.fullness = 0;
    if (this.fullness > TUNE.fullness.max) this.fullness = TUNE.fullness.max;
  }

  get isDead(): boolean {
    return this.health <= 0;
  }

  // ── Fullness ──

  drainFullness(amount: number): void {
    this.fullness = Math.max(0, this.fullness - amount);
  }

  addFullness(amount: number): void {
    this.fullness = Math.min(TUNE.fullness.max, this.fullness + amount);
  }

  // ── XP & Leveling ──

  addXp(amount: number): void {
    this.xp += amount;
  }

  xpToNextLevel(): number {
    return this.level * TUNE.xp.perLevel;
  }

  canLevelUp(): boolean {
    return this.xp >= this.xpToNextLevel() && this.level < TUNE.levelCap;
  }

  levelUp(): void {
    if (this.level >= TUNE.levelCap) return;
    this.xp -= this.xpToNextLevel();
    this.level++;
    this.maxHealth += 8;
    this.attack += 1.5;
    this.maxEnergy += TUNE.maxEnergyPerLevel;
  }

  // ── Inventory ──

  inventoryTotal(): number {
    return this.inventory.food + this.inventory.water + this.inventory.wood;
  }

  inventoryFull(): boolean {
    return this.inventoryTotal() >= TUNE.inventory.capacity;
  }

  addToInventory(type: keyof IInventory, amount: number): number {
    const space = TUNE.inventory.capacity - this.inventoryTotal();
    const actual = Math.min(amount, space);
    this.inventory[type] += actual;
    return actual;
  }

  removeFromInventory(type: keyof IInventory, amount: number): number {
    const actual = Math.min(this.inventory[type], amount);
    this.inventory[type] -= actual;
    return actual;
  }
}
