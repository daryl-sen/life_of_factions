export class Faction {
  readonly id: string;
  readonly members: Set<string>;
  color: string;
  createdAtTick: number;

  constructor(id: string, color: string, members?: Set<string>, createdAtTick?: number) {
    this.id = id;
    this.color = color;
    this.members = members ?? new Set();
    this.createdAtTick = createdAtTick ?? 0;
  }

  get size(): number {
    return this.members.size;
  }

  /** Territory radius in grid cells. Base 10, +1 per 5 members, capped at 25. */
  territoryRadius(): number {
    return Math.min(25, 10 + Math.floor(this.members.size / 5));
  }

  addMember(agentId: string): void {
    this.members.add(agentId);
  }

  removeMember(agentId: string): void {
    this.members.delete(agentId);
  }

  hasMember(agentId: string): boolean {
    return this.members.has(agentId);
  }
}
