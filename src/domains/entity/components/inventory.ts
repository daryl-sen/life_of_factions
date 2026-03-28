import type { ResourceType } from '../../../core/types';

export class Inventory {
  food: number;
  water: number;
  wood: number;
  readonly capacity: number;

  constructor(capacity: number, food = 0, water = 0, wood = 0) {
    this.capacity = capacity;
    this.food = food;
    this.water = water;
    this.wood = wood;
  }

  total(): number {
    return this.food + this.water + this.wood;
  }

  isFull(): boolean {
    return this.total() >= this.capacity;
  }

  add(type: ResourceType, amount: number): number {
    const space = this.capacity - this.total();
    const actual = Math.min(amount, space);
    this[type] += actual;
    return actual;
  }

  remove(type: ResourceType, amount: number): number {
    const actual = Math.min(this[type], amount);
    this[type] -= actual;
    return actual;
  }
}
