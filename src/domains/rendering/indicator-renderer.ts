import { CELL_PX } from '../../core/constants';
import type { Organism } from '../entity/organism';
import type { EmojiCache } from './emoji-cache';
import type { Camera } from './camera';
import type { Faction } from '../faction/faction';
// Structural alias — any object with a `color` string satisfies the faction slot
type FactionLike = Pick<Faction, 'color'>;
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
    cx: number,
    cy: number,
    camera: Camera,
    factions: Map<string, FactionLike>,
  ): void {
    const scale = camera.scale;
    const indicatorSize = CELL_PX * scale * 0.5;
    const offset        = CELL_PX * scale * 0.35;

    const positions = {
      topLeft:   { sx: cx - offset, sy: cy - offset },
      topRight:  { sx: cx + offset, sy: cy - offset },
      topMiddle: { sx: cx,          sy: cy - CELL_PX * scale * 0.6 },
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
    factions: Map<string, FactionLike>,
  ): void {
    if (config.source === 'none') return;

    if (config.source === 'faction_flag' && organism.factionId) {
      const faction = factions.get(organism.factionId);
      if (faction) {
        const { canvas: fc, w: fw, h: fh } = this.emojiCache.getTinted('\u{1F6A9}', faction.color);
        const fScale = Math.min(size / fw, size / fh);
        ctx.drawImage(fc, pos.sx - (fw * fScale) / 2, pos.sy - (fh * fScale) / 2, fw * fScale, fh * fScale);
        return;
      }
    }

    const emoji = this.resolveEmoji(organism, config.source);
    if (!emoji) return;
    this.emojiCache.drawAt(ctx, emoji, pos.sx, pos.sy, size);
  }

  private resolveEmoji(organism: Organism, source: IndicatorSource): string | null {
    switch (source) {
      case 'faction_flag':
        return null; // handled above with tinting
      case 'pregnancy':
        return organism.pregnancy?.active ? '\u{1F95A}' : null; // 🥚
      case 'health_band': {
        const ratio = organism.health / organism.maxHealth;
        if (ratio > 0.7) return '\u{1F49A}'; // 💚
        if (ratio > 0.3) return '\u{1F49B}'; // 💛
        return '\u2764\uFE0F'; // ❤️
      }
      case 'mood':
        return organism.lifecycleStage === LifecycleStage.Juvenile ? '\u{1F476}' : null; // 👶 for juveniles
      case 'level':
        return null; // text rendering not supported in emoji slot
      case 'phenotype':
        return null; // phenotype icon registry TBD
      case 'none':
      default:
        return null;
    }
  }
}
