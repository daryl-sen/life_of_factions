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
