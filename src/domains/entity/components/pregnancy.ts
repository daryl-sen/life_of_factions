import { TUNE } from '../../../core/tuning';

interface ChildNeeds {
  fullness: number;
  hygiene: number;
  social: number;
  inspiration: number;
}

interface PregnancyStartOpts {
  childDna: string;
  childFamilyName: string;
  childFactionId: string | null;
  partnerId: string | null;
  transferRate: number;
  startTick: number;
}

/**
 * v5 pregnancy: gradual need transfer from parent to offspring during gestation.
 * The parent feeds the child from its own reserves each tick until child needs
 * reach TUNE.pregnancy.completionThreshold, at which point birth occurs.
 */
export class PregnancyState {
  active = false;
  childDna: string | null = null;
  childFamilyName: string | null = null;
  childFactionId: string | null = null;
  partnerId: string | null = null;
  gestationStartTick = 0;
  transferRate: number = TUNE.pregnancy.needTransferRate;

  childNeeds: ChildNeeds = { fullness: 0, hygiene: 0, social: 0, inspiration: 0 };

  start(opts: PregnancyStartOpts): void {
    this.active             = true;
    this.childDna           = opts.childDna;
    this.childFamilyName    = opts.childFamilyName;
    this.childFactionId     = opts.childFactionId;
    this.partnerId          = opts.partnerId;
    this.transferRate       = opts.transferRate;
    this.gestationStartTick = opts.startTick;
    this.childNeeds         = { fullness: 0, hygiene: 0, social: 0, inspiration: 0 };
  }

  /**
   * Per-tick transfer step.
   * Returns the amount drained from each parent need (parent drains in addition to normal decay).
   */
  tickTransfer(): { fullnessDrained: number; hygieneDrained: number; socialDrained: number; inspirationDrained: number } {
    if (!this.active) {
      return { fullnessDrained: 0, hygieneDrained: 0, socialDrained: 0, inspirationDrained: 0 };
    }

    const rate = this.transferRate;
    this.childNeeds.fullness    = Math.min(100, this.childNeeds.fullness + rate);
    this.childNeeds.hygiene     = Math.min(100, this.childNeeds.hygiene + rate);
    this.childNeeds.social      = Math.min(100, this.childNeeds.social + rate);
    this.childNeeds.inspiration = Math.min(100, this.childNeeds.inspiration + rate);

    return {
      fullnessDrained:    rate,
      hygieneDrained:     rate,
      socialDrained:      rate,
      inspirationDrained: rate,
    };
  }

  /** Returns true when all child needs reach the birth threshold */
  isReadyForBirth(): boolean {
    const threshold = TUNE.pregnancy.completionThreshold;
    return (
      this.childNeeds.fullness    >= threshold &&
      this.childNeeds.hygiene     >= threshold &&
      this.childNeeds.social      >= threshold &&
      this.childNeeds.inspiration >= threshold
    );
  }

  end(): void {
    this.active             = false;
    this.childDna           = null;
    this.childFamilyName    = null;
    this.childFactionId     = null;
    this.partnerId          = null;
    this.gestationStartTick = 0;
    this.childNeeds         = { fullness: 0, hygiene: 0, social: 0, inspiration: 0 };
  }
}
