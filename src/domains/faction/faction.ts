export class Faction {
  readonly id: string;
  readonly members: Set<string>;
  color: string;

  constructor(id: string, color: string, members?: Set<string>) {
    this.id = id;
    this.color = color;
    this.members = members ?? new Set();
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
