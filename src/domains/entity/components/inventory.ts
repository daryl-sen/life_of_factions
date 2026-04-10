import type { ResourceType, IInventory } from '../../../core/types';

/** v5 Inventory supports plant food, meat food, water, and wood separately */
export class Inventory {
  plantFood: number;
  meatFood: number;
  water: number;
  wood: number;
  readonly capacity: number;

  constructor(capacity: number, init?: Partial<IInventory>) {
    this.capacity  = capacity;
    this.plantFood = init?.plantFood ?? 0;
    this.meatFood  = init?.meatFood  ?? 0;
    this.water     = init?.water     ?? 0;
    this.wood      = init?.wood      ?? 0;
  }

  total(): number {
    return this.plantFood + this.meatFood + this.water + this.wood;
  }

  isFull(): boolean {
    return this.total() >= this.capacity;
  }

  add(type: ResourceType, amount: number): number {
    const space  = this.capacity - this.total();
    const actual = Math.min(amount, Math.max(0, space));
    this[type]  += actual;
    return actual;
  }

  remove(type: ResourceType, amount: number): number {
    const actual = Math.min(this[type], amount);
    this[type]  -= actual;
    return actual;
  }
}
