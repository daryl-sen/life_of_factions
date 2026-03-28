export class RelationshipMap {
  private readonly data: Map<string, number>;
  readonly maxSlots: number;

  constructor(maxSlots: number, existing?: Map<string, number>) {
    this.maxSlots = maxSlots;
    this.data = existing ? new Map(existing) : new Map();
  }

  get(agentId: string): number {
    return this.data.get(agentId) ?? 0;
  }

  set(agentId: string, value: number): void {
    // Clamp to [-1, 1]
    let v = value;
    if (v > 1) v = 1;
    if (v < -1) v = -1;
    // Normalize near-zero to 0
    if (Math.abs(v) < 0.01) v = 0;

    if (v === 0) {
      this.data.delete(agentId);
      return;
    }

    this.data.set(agentId, v);
    this.prune();
  }

  adjust(agentId: string, delta: number): number {
    const current = this.get(agentId);
    const next = current + delta;
    this.set(agentId, next);
    return this.get(agentId);
  }

  has(agentId: string): boolean {
    return this.data.has(agentId);
  }

  delete(agentId: string): void {
    this.data.delete(agentId);
  }

  get size(): number {
    return this.data.size;
  }

  entries(): IterableIterator<[string, number]> {
    return this.data.entries();
  }

  /** Export raw map for serialization */
  toMap(): Map<string, number> {
    return new Map(this.data);
  }

  private prune(): void {
    if (this.data.size <= this.maxSlots) return;
    // Remove the entry with smallest absolute value
    let worstKey: string | null = null;
    let worstAbs = Infinity;
    for (const [k, v] of this.data) {
      const abs = Math.abs(v);
      if (abs < worstAbs) {
        worstAbs = abs;
        worstKey = k;
      }
    }
    if (worstKey) this.data.delete(worstKey);
  }
}
