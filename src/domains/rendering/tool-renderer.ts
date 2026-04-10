import { CELL_PX } from '../../core/constants';
import type { Organism } from '../entity/organism';
import type { IActionState } from '../action/types';
import type { EmojiCache } from './emoji-cache';
import type { Camera } from './camera';
import { ACTION_REGISTRY } from '../action/action-registry';

/**
 * Renders directional tool emojis between an organism and its target.
 * Only fires for actions with targetType === 'external_cell' that have a tool emoji.
 */
export class ToolRenderer {
  constructor(private readonly emojiCache: EmojiCache) {}

  render(
    ctx: CanvasRenderingContext2D,
    organism: Organism,
    action: IActionState,
    camera: Camera,
  ): void {
    const def = ACTION_REGISTRY.get(action.type);
    if (!def?.tool || def.targetType !== 'external_cell') return;
    if (!action.target) return;

    const { sx: ox, sy: oy } = camera.worldToScreen(organism.cellX, organism.cellY);
    const { sx: tx, sy: ty } = camera.worldToScreen(action.target.x, action.target.y);

    const mx    = (ox + tx) / 2;
    const my    = (oy + ty) / 2;
    const angle = Math.atan2(ty - oy, tx - ox);

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    this.emojiCache.drawAt(ctx, def.tool, 0, 0, CELL_PX * camera.scale * 0.6);
    ctx.restore();
  }
}
