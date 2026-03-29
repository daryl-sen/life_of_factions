export interface FamilyStats {
  familyName: string;
  totalBorn: number;
  currentlyAlive: number;
  totalAgeMs: number;
  deathCount: number;
  maxGeneration: number;
}

export class FamilyRegistry {
  private readonly families = new Map<string, FamilyStats>();
  private _version = 0;
  private _cachedAlive: FamilyStats[] = [];
  private _cachedAliveVersion = -1;

  /** Monotonic version counter — increments on every mutation. */
  get version(): number { return this._version; }

  registerBirth(familyName: string, generation: number = 1): void {
    const stats = this.getOrCreate(familyName);
    stats.totalBorn++;
    stats.currentlyAlive++;
    if (generation > stats.maxGeneration) {
      stats.maxGeneration = generation;
    }
    this._version++;
  }

  registerDeath(familyName: string, ageMs: number): void {
    const stats = this.families.get(familyName);
    if (!stats) return;
    stats.currentlyAlive = Math.max(0, stats.currentlyAlive - 1);
    stats.totalAgeMs += ageMs;
    stats.deathCount++;
    this._version++;
  }

  getStats(familyName: string): FamilyStats | undefined {
    return this.families.get(familyName);
  }

  /** Returns families with living members (cached, rebuilds only on mutation). */
  getAllFamilies(): FamilyStats[] {
    if (this._cachedAliveVersion === this._version) return this._cachedAlive;
    this._cachedAlive = Array.from(this.families.values())
      .filter(f => f.currentlyAlive > 0)
      .sort((a, b) => b.currentlyAlive - a.currentlyAlive);
    this._cachedAliveVersion = this._version;
    return this._cachedAlive;
  }

  /** Returns all families including those with no living members (for serialization). */
  getAllFamiliesIncludingDead(): FamilyStats[] {
    return Array.from(this.families.values());
  }

  averageLongevity(familyName: string): number {
    const stats = this.families.get(familyName);
    if (!stats || stats.deathCount === 0) return 0;
    return stats.totalAgeMs / stats.deathCount;
  }

  private getOrCreate(familyName: string): FamilyStats {
    let stats = this.families.get(familyName);
    if (!stats) {
      stats = {
        familyName,
        totalBorn: 0,
        currentlyAlive: 0,
        totalAgeMs: 0,
        deathCount: 0,
        maxGeneration: 1,
      };
      this.families.set(familyName, stats);
    }
    return stats;
  }

  restoreFamily(stats: FamilyStats): void {
    this.families.set(stats.familyName, { ...stats });
    this._version++;
  }

  clear(): void {
    this.families.clear();
    this._version++;
  }
}
