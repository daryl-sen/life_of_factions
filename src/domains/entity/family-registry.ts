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

  registerBirth(familyName: string, generation: number = 1): void {
    const stats = this.getOrCreate(familyName);
    stats.totalBorn++;
    stats.currentlyAlive++;
    if (generation > stats.maxGeneration) {
      stats.maxGeneration = generation;
    }
  }

  registerDeath(familyName: string, ageMs: number): void {
    const stats = this.families.get(familyName);
    if (!stats) return;
    stats.currentlyAlive = Math.max(0, stats.currentlyAlive - 1);
    stats.totalAgeMs += ageMs;
    stats.deathCount++;
  }

  getStats(familyName: string): FamilyStats | undefined {
    return this.families.get(familyName);
  }

  getAllFamilies(): FamilyStats[] {
    return Array.from(this.families.values())
      .sort((a, b) => b.currentlyAlive - a.currentlyAlive);
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

  clear(): void {
    this.families.clear();
  }
}
