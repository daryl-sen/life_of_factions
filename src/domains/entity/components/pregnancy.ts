import { TUNE } from '../../../core/tuning';

export interface PregnancyStartOpts {
  childDna: string;
  childFamilyName: string;
  childFactionId: string | null;
  partnerId: string | null;
  /** True: v4.2 gradual need-transfer gestation. False: v4 countdown timer. */
  useTransferMechanic: boolean;
  // v4.2 transfer mechanic fields
  transferRate?: number;
  gestationStartTick?: number;
  // v4 fallback fields
  donatedFullness?: number;
  remainingMs?: number;
}

export class PregnancyState {
  // ── Shared fields (both paths) ──
  active = false;
  childDna: string | null = null;
  childFamilyName: string | null = null;
  childFactionId: string | null = null;
  partnerId: string | null = null;

  // ── v4 fallback fields ──
  remainingMs = 0;
  donatedFullness = 0;

  // ── v4.2 transfer mechanic fields ──
  useTransferMechanic = false;
  childNeeds = { fullness: 0, hygiene: 0, social: 0, inspiration: 0 };
  /** Per-tick rate at which child needs fill (and parent needs drain). */
  transferRate = 0;
  gestationStartTick = 0;

  start(opts: PregnancyStartOpts): void {
    this.active = true;
    this.childDna = opts.childDna;
    this.childFamilyName = opts.childFamilyName;
    this.childFactionId = opts.childFactionId;
    this.partnerId = opts.partnerId;
    this.useTransferMechanic = opts.useTransferMechanic;

    if (opts.useTransferMechanic) {
      this.transferRate = opts.transferRate ?? TUNE.pregnancy.needTransferRate;
      this.gestationStartTick = opts.gestationStartTick ?? 0;
      this.childNeeds = { fullness: 0, hygiene: 0, social: 0, inspiration: 0 };
      // v4 fallback fields unused on this path
      this.remainingMs = 0;
      this.donatedFullness = 0;
    } else {
      this.remainingMs = opts.remainingMs ?? 0;
      this.donatedFullness = opts.donatedFullness ?? 0;
      // v4.2 fields unused on this path
      this.transferRate = 0;
      this.gestationStartTick = 0;
      this.childNeeds = { fullness: 0, hygiene: 0, social: 0, inspiration: 0 };
    }
  }

  /**
   * Per-tick transfer step (v4.2 path only).
   * Increases each child need by `transferRate` and returns how much
   * was drained from each of the parent's needs.
   */
  tickTransfer(): { fullnessDrained: number; hygieneDrained: number; socialDrained: number; inspirationDrained: number } {
    const r = this.transferRate;
    this.childNeeds.fullness    = Math.min(100, this.childNeeds.fullness    + r);
    this.childNeeds.hygiene     = Math.min(100, this.childNeeds.hygiene     + r);
    this.childNeeds.social      = Math.min(100, this.childNeeds.social      + r);
    this.childNeeds.inspiration = Math.min(100, this.childNeeds.inspiration + r);
    return {
      fullnessDrained:    r,
      hygieneDrained:     r,
      socialDrained:      r,
      inspirationDrained: r,
    };
  }

  /** True when all child needs have reached the completion threshold (v4.2 path). */
  isReadyForBirth(): boolean {
    const t = TUNE.pregnancy.completionThreshold;
    return (
      this.childNeeds.fullness    >= t &&
      this.childNeeds.hygiene     >= t &&
      this.childNeeds.social      >= t &&
      this.childNeeds.inspiration >= t
    );
  }

  /** Tick the v4 countdown timer. Returns true when birth occurs. */
  tick(dtMs: number): boolean {
    if (!this.active) return false;
    this.remainingMs -= dtMs;
    return this.remainingMs <= 0;
  }

  clear(): void {
    this.active = false;
    this.remainingMs = 0;
    this.childDna = null;
    this.childFamilyName = null;
    this.childFactionId = null;
    this.partnerId = null;
    this.donatedFullness = 0;
    this.useTransferMechanic = false;
    this.childNeeds = { fullness: 0, hygiene: 0, social: 0, inspiration: 0 };
    this.transferRate = 0;
    this.gestationStartTick = 0;
  }
}
