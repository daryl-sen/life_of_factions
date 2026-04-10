import { CELL_PX } from '../../core/constants';
import type { Organism } from '../entity/organism';
import type { EmojiCache } from './emoji-cache';
import type { Camera } from './camera';
import { LifecycleStage } from '../phenotype/types';

export type IndicatorSource =
  | 'faction_flag'
  | 'pregnancy'
  | 'health_band'
  | 'mood'
  | 'level'
  | 'phenotype'
  | 'none';

export interface IndicatorSlotConfig {
  source: IndicatorSource;
}

/**
 * Renders three indicator slots around an organism emoji.
 * Each slot's data source is independently configurable via the UI.
 */
export class IndicatorRenderer {
  constructor(
    private emojiCache: EmojiCache,
    public slotConfig: {
      topLeft:   IndicatorSlotConfig;
      topRight:  IndicatorSlotConfig;
      topMiddle: IndicatorSlotConfig;
    },
  ) {}

  render(
    ctx: CanvasRenderingContext2D,
    organism: Organism,
    sx: number,
    sy: number,
    scale: number,
    factions: Map<string, { flag?: string }>,
  ): void {
    const indicatorSize = CELL_PX * scale * 0.5;
    const offset        = CELL_PX * scale * 0.35;

    const positions = {
      topLeft:   { sx: sx - offset, sy: sy - offset },
      topRight:  { sx: sx + offset, sy: sy - offset },
      topMiddle: { sx: sx,          sy: sy - CELL_PX * scale * 0.5 },
    };

    this.renderSlot(ctx, organism, this.slotConfig.topLeft,   positions.topLeft,   indicatorSize, factions);
    this.renderSlot(ctx, organism, this.slotConfig.topRight,  positions.topRight,  indicatorSize, factions);
    this.renderSlot(ctx, organism, this.slotConfig.topMiddle, positions.topMiddle, indicatorSize, factions);
  }

  private renderSlot(
    ctx: CanvasRenderingContext2D,
    organism: Organism,
    config: IndicatorSlotConfig,
    pos: { sx: number; sy: number },
    size: number,
    factions: Map<string, { flag?: string }>,
  ): void {
    const emoji = this.resolveEmoji(organism, config.source, factions);
    if (!emoji) return;
    this.emojiCache.drawAt(ctx, emoji, pos.sx, pos.sy, size);
  }

  private resolveEmoji(
    organism: Organism,
    source: IndicatorSource,
    factions: Map<string, { flag?: string }>,
  ): string | null {
    switch (source) {
      case 'faction_flag': {
        if (!organism.factionId) return null;
        return factions.get(organism.factionId)?.flag ?? '🚩';
      }
      case 'pregnancy':
        return organism.pregnancy?.active ? '🥚' : null;
      case 'health_band': {
        const ratio = organism.health / organism.maxHealth;
        if (ratio > 0.7) return '💚';
        if (ratio > 0.3) return '💛';
        return '❤️';
      }
      case 'mood':
        return organism.lifecycleStage === LifecycleStage.Juvenile ? null : null; // mood logic TBD
      case 'level':
        return null; // level uses text rendering
      case 'phenotype':
        return null; // phenotype icon registry TBD
      case 'none':
      default:
        return null;
    }
  }
}
