export interface IPosition {
  readonly x: number;
  readonly y: number;
}

export interface IInventory {
  food: number;
  water: number;
  wood: number;
}

export type ResourceType = 'food' | 'water' | 'wood';

export type ResourceMemoryType = 'food' | 'water' | 'wood';

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
