import { CELL_PX } from '../../core/constants';
import type { Organism } from '../entity/organism';
import type { EmojiCache } from './emoji-cache';
import type { Camera } from './camera';
import type { AnimationRunner } from './animation-runner';
import type { IndicatorRenderer } from './indicator-renderer';
import type { ToolRenderer } from './tool-renderer';

/**
 * Unified organism renderer — draws base emoji + animations + indicators + tool.
 * Replaces v4's split agent/tree rendering paths.
 */
export class OrganismRenderer {
  constructor(
    private readonly emojiCache: EmojiCache,
    private readonly animationRunner: AnimationRunner,
    private readonly indicatorRenderer: IndicatorRenderer,
    private readonly toolRenderer: ToolRenderer,
  ) {}

  render(
    ctx: CanvasRenderingContext2D,
    organism: Organism,
    camera: Camera,
    factions: Map<string, { flag?: string }>,
    showHealthBars: boolean,
  ): void {
    const { sx, sy } = camera.worldToScreen(organism.cellX, organism.cellY);

    // 1. Animation transform
    const transform = this.animationRunner.getTransform(organism);
    const sizeScale = this.computeSizeScale(organism);

    // 2. Draw base emoji
    ctx.save();
    ctx.translate(sx + transform.dx, sy + transform.dy);
    ctx.rotate(transform.rotation);
    const s = transform.scale * sizeScale;
    ctx.scale(s, s);
    this.emojiCache.draw(ctx, organism.currentEmoji, 0, 0);
    ctx.restore();

    // 3. Indicators
    this.indicatorRenderer.render(ctx, organism, sx, sy, camera.scale, factions);

    // 4. Tool (directional, only for external_cell actions)
    if (organism.action?.target) {
      this.toolRenderer.render(ctx, organism, organism.action, camera);
    }

    // 5. Health/energy bars
    if (showHealthBars) {
      this.drawHealthBar(ctx, organism, sx, sy, camera.scale);
    }
  }

  private computeSizeScale(organism: Organism): number {
    return 1 + Math.min(0.8, organism.traits.size.value * 0.01);
  }

  private drawHealthBar(
    ctx: CanvasRenderingContext2D,
    organism: Organism,
    sx: number,
    sy: number,
    scale: number,
  ): void {
    const barW  = CELL_PX * scale;
    const barH  = 3 * scale;
    const x     = sx - barW / 2;
    const y     = sy + CELL_PX * scale * 0.4;
    const ratio = Math.max(0, organism.health / organism.maxHealth);

    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = ratio > 0.5 ? '#60e6a8' : ratio > 0.25 ? '#ffa726' : '#ff5252';
    ctx.fillRect(x, y, barW * ratio, barH);
  }
}
