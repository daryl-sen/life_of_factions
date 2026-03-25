import type { IActionState, IPosition, TravelPref } from '../../shared/types';
import { TUNE, ENERGY_CAP } from '../../shared/constants';
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

  constructor(opts: {
    id: string;
    name: string;
    cellX: number;
    cellY: number;
    health?: number;
    maxHealth?: number;
    energy?: number;
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
    this.energy = Math.min(ENERGY_CAP, this.energy + amount);
  }

  clampStats(): void {
    if (this.energy < 0) this.energy = 0;
    if (this.energy > ENERGY_CAP) this.energy = ENERGY_CAP;
  }

  get isDead(): boolean {
    return this.health <= 0;
  }

  levelUp(): void {
    if (this.level >= TUNE.levelCap) return;
    this.level++;
    this.maxHealth += 8;
    this.attack += 1.5;
  }
}
