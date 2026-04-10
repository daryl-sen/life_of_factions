export interface IPosition {
  readonly x: number;
  readonly y: number;
}

export type FoodType = 'plant' | 'meat';

export interface IInventory {
  plantFood: number;
  meatFood: number;
  water: number;
  wood: number;
}

export type ResourceType = keyof IInventory;
export type ResourceMemoryType = 'plantFood' | 'meatFood' | 'water' | 'wood' | 'corpse';

export interface IResourceMemoryEntry {
  x: number;
  y: number;
  tick: number;
}

export interface ICameraState {
  x: number;
  y: number;
  scale: number;
  min: number;
  max: number;
  viewW: number;
  viewH: number;
}
