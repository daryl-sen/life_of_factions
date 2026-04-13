import { CELL_PX, WORLD_EMOJIS } from '../../core/constants';
import type { Agent } from '../entity/agent';
import type { World } from '../world/world';
import { evaluateNeeds } from '../decision/need-evaluator';
import { computeMood } from '../decision/mood-evaluator';
import { Mood } from '../entity/types';
import { EmojiCache } from './emoji-cache';

export type IndicatorSource =
  | 'faction_flag'
  | 'pregnancy'
  | 'health_band'
  | 'mood'
  | 'level'
  | 'none';

export interface IndicatorSlotConfig {
  source: IndicatorSource;
}

const HEALTH_EMOJIS = {
  good:   '\u{1F49A}',   // 💚
  medium: '\u{1F49B}',   // 💛
  low:    '\u2764\uFE0F', // ❤️
} as const;

const MOOD_EMOJIS: Record<string, string> = {
  [Mood.HAPPY]:      '\u{1F600}',   // 😀
  [Mood.CONTENT]:    '\u{1F642}',   // 🙂
  [Mood.UNHAPPY]:    '\u{1F629}',   // 😩
  [Mood.FRUSTRATED]: '\u{1F621}',   // 😡
};

/**
 * Renders configurable indicator slots around an agent's cell.
 * Slots: topLeft, topRight (two top slots), bottomMiddle (below the agent).
 *
 * v4.2: Replaces the hardcoded pregnancy+faction_flag indicators in renderer.ts.
 * Each slot can independently show faction_flag, pregnancy, health_band, mood,
 * level, or nothing. The configuration can be changed at runtime via the UI.
 *
 * Default layout:
 *   topLeft  = faction_flag
 *   topRight = none (reserved for future profession indicator)
 *   bottomMiddle = pregnancy
 */
export class IndicatorRenderer {
  private readonly _cache: EmojiCache;

  constructor(
    private readonly _slotConfig: {
      topLeft:      IndicatorSlotConfig;
      topRight:     IndicatorSlotConfig;
      bottomMiddle: IndicatorSlotConfig;
    },
    emojiCache: EmojiCache
  ) {
    this._cache = emojiCache;
  }

  render(
    ctx: CanvasRenderingContext2D,
    agent: Agent,
    cellPixelX: number,
    cellPixelY: number,
    world: World
  ): void {
    const indicatorSize = CELL_PX * 0.45;

    const positions = {
      topLeft:      { x: cellPixelX + CELL_PX * 0.05,  y: cellPixelY - CELL_PX * 0.35 },
      topRight:     { x: cellPixelX + CELL_PX * 0.7,   y: cellPixelY - CELL_PX * 0.35 },
      bottomMiddle: { x: cellPixelX + CELL_PX * 0.375, y: cellPixelY + CELL_PX * 0.85 },
    };

    this._renderSlot(ctx, agent, this._slotConfig.topLeft,      positions.topLeft,      indicatorSize, world);
    this._renderSlot(ctx, agent, this._slotConfig.topRight,     positions.topRight,     indicatorSize, world);
    this._renderSlot(ctx, agent, this._slotConfig.bottomMiddle, positions.bottomMiddle, indicatorSize, world);
  }

  private _renderSlot(
    ctx: CanvasRenderingContext2D,
    agent: Agent,
    slot: IndicatorSlotConfig,
    pos: { x: number; y: number },
    size: number,
    world: World
  ): void {
    if (slot.source === 'faction_flag') {
      if (!agent.factionId) return;
      const faction = world.factions.get(agent.factionId);
      if (!faction) return;
      const { canvas: fc, w, h } = this._cache.getTinted(WORLD_EMOJIS.flag, faction.color);
      const scale = Math.min(size / w, size / h);
      ctx.drawImage(fc, pos.x, pos.y, w * scale, h * scale);
      return;
    }

    if (slot.source === 'level') {
      ctx.save();
      ctx.font = `bold ${Math.round(size * 0.7)}px sans-serif`;
      ctx.fillStyle = '#ffffcc';
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(String(agent.level), pos.x + size / 2, pos.y + size / 2);
      ctx.fillText(String(agent.level), pos.x + size / 2, pos.y + size / 2);
      ctx.restore();
      return;
    }

    const emoji = this._resolveEmoji(agent, slot.source, world);
    if (!emoji) return;

    const { canvas: ec, w, h } = this._cache.get(emoji);
    const scale = Math.min(size / w, size / h);
    ctx.drawImage(ec, pos.x, pos.y, w * scale, h * scale);
  }

  private _resolveEmoji(agent: Agent, source: IndicatorSource, _world: World): string | null {
    switch (source) {
      case 'faction_flag':
        return null; // handled in _renderSlot via tinted flag
      case 'pregnancy':
        return agent.pregnancy.active ? '\u{1F95A}' : null;   // 🥚
      case 'health_band': {
        const ratio = agent.maxHealth > 0 ? agent.health / agent.maxHealth : 0;
        if (ratio > 0.7) return HEALTH_EMOJIS.good;
        if (ratio > 0.3) return HEALTH_EMOJIS.medium;
        return HEALTH_EMOJIS.low;
      }
      case 'mood': {
        const mood = computeMood(evaluateNeeds(agent));
        return MOOD_EMOJIS[mood] ?? null;
      }
      case 'none':
      default:
        return null;
    }
  }

  /** Update a slot's source (called from the indicator config UI). */
  setSlot(slot: 'topLeft' | 'topRight' | 'bottomMiddle', source: IndicatorSource): void {
    this._slotConfig[slot].source = source;
  }
}
