export class PregnancyState {
  active = false;
  remainingMs = 0;
  childDna: string | null = null;
  childFamilyName: string | null = null;
  childFactionId: string | null = null;
  partnerId: string | null = null;
  donatedFullness = 0;

  start(dna: string, durationMs: number, familyName: string, factionId: string | null, partnerId?: string | null, donatedFullness?: number): void {
    this.active = true;
    this.remainingMs = durationMs;
    this.childDna = dna;
    this.childFamilyName = familyName;
    this.childFactionId = factionId;
    this.partnerId = partnerId ?? null;
    this.donatedFullness = donatedFullness ?? 0;
  }

  /** Tick the pregnancy timer. Returns true when birth occurs. */
  tick(dtMs: number): boolean {
    if (!this.active) return false;
    this.remainingMs -= dtMs;
    if (this.remainingMs <= 0) {
      return true;
    }
    return false;
  }

  clear(): void {
    this.active = false;
    this.remainingMs = 0;
    this.childDna = null;
    this.childFamilyName = null;
    this.childFactionId = null;
    this.partnerId = null;
    this.donatedFullness = 0;
  }
}
