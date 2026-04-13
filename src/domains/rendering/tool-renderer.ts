import { CELL_PX } from '../../core/constants';
import type { Agent } from '../entity/agent';
import type { World } from '../world/world';
import type { IActionState } from '../action/types';
import { ACTION_REGISTRY } from '../action/action-registry';
import { EmojiCache } from './emoji-cache';

/**
 * Renders tool emojis between an agent and its action target.
 *
 * v4.2: Generalises the hardcoded attack (🗡️) and harvest (🤚) line rendering
 * in renderer.ts to any action with `targetType === 'external_cell'` and a
 * non-null `tool` in the action registry.
 *
 * Tool emojis are drawn at the midpoint between agent and target, rotated to
 * face the target.
 */
export class ToolRenderer {
  private readonly _cache: EmojiCache;

  constructor(emojiCache: EmojiCache) {
    this._cache = emojiCache;
  }

  /**
   * Render tool lines for all agents collected during the agent-render pass.
   * Called after the agent pass so tools appear on top of agents.
   */
  renderAll(
    ctx: CanvasRenderingContext2D,
    lines: Array<{ agent: Agent; action: IActionState }>,
    world: World
  ): void {
    for (const { agent, action } of lines) {
      this._renderTool(ctx, agent, action, world);
    }
  }

  private _renderTool(
    ctx: CanvasRenderingContext2D,
    agent: Agent,
    action: IActionState,
    world: World
  ): void {
    const def = ACTION_REGISTRY.get(action.type);
    if (!def || def.targetType !== 'external_cell' || !def.tool) return;

    const targetPx = this._resolveTargetPx(action, world);
    if (!targetPx) return;

    const at = agent.lerpT != null ? agent.lerpT : 1;
    const ax = ((agent.prevCellX ?? agent.cellX) + (agent.cellX - (agent.prevCellX ?? agent.cellX)) * at) * CELL_PX + CELL_PX / 2;
    const ay = ((agent.prevCellY ?? agent.cellY) + (agent.cellY - (agent.prevCellY ?? agent.cellY)) * at) * CELL_PX + CELL_PX / 2;

    const mx = (ax + targetPx.x) / 2;
    const my = (ay + targetPx.y) / 2;
    const angle = Math.atan2(targetPx.y - ay, targetPx.x - ax);

    const { canvas: ec, w, h } = this._cache.get(def.tool);
    const toolSize = CELL_PX - 2;
    const scale = Math.min(toolSize / w, toolSize / h);
    const dw = w * scale;
    const dh = h * scale;

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.translate(mx, my);
    // Offset angle by 5π/4 to match existing attack-line orientation convention
    ctx.rotate(angle + Math.PI * 1.25);
    ctx.drawImage(ec, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  private _resolveTargetPx(
    action: IActionState,
    world: World
  ): { x: number; y: number } | null {
    if (action.payload?.targetId) {
      const target = world.agentsById.get(action.payload.targetId);
      if (!target) return null;
      const tt = target.lerpT != null ? target.lerpT : 1;
      return {
        x: ((target.prevCellX ?? target.cellX) + (target.cellX - (target.prevCellX ?? target.cellX)) * tt) * CELL_PX + CELL_PX / 2,
        y: ((target.prevCellY ?? target.cellY) + (target.cellY - (target.prevCellY ?? target.cellY)) * tt) * CELL_PX + CELL_PX / 2,
      };
    }
    if (action.payload?.targetPos) {
      return {
        x: action.payload.targetPos.x * CELL_PX + CELL_PX / 2,
        y: action.payload.targetPos.y * CELL_PX + CELL_PX / 2,
      };
    }
    return null;
  }
}
