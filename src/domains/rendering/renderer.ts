import { CELL, GRID, COLORS, AGENT_EMOJIS, WORLD_EMOJIS, FOOD_EMOJIS, TUNE } from '../../shared/constants';
import { getIdleEmoji } from '../../shared/utils';
import type { World } from '../world';
import type { Agent } from '../agent';
import { Camera } from './camera';
import { EmojiCache } from './emoji-cache';

export class Renderer {
  private readonly _emojiCache = new EmojiCache();

  render(world: World, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, camera: Camera): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      camera.scale, 0, 0, camera.scale,
      -camera.x * camera.scale,
      -camera.y * camera.scale
    );

    if (world.drawGrid) this._drawGrid(ctx, camera);
    this._drawWaterBlocks(ctx, world);
    this._drawTreeBlocks(ctx, world);
    this._drawSeedlings(ctx, world);
    this._drawFoodBlocks(ctx, world);
    this._drawLootBags(ctx, world);
    this._drawFarms(ctx, world);
    this._drawWalls(ctx, world);
    this._drawFlags(ctx, world);

    const pendingAttackLines: [Agent, Agent][] = [];
    this._drawAgents(ctx, world, pendingAttackLines);
    this._drawAttackLines(ctx, camera, pendingAttackLines);

    this._drawClouds(ctx, world, camera);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private _drawGrid(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1 / camera.scale;
    ctx.beginPath();
    for (let i = 0; i <= GRID; i++) {
      const y = i * CELL + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(GRID * CELL, y);
    }
    for (let i = 0; i <= GRID; i++) {
      const x = i * CELL + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GRID * CELL);
    }
    ctx.stroke();
    ctx.restore();
  }

  private _drawCellEmoji(ctx: CanvasRenderingContext2D, cellX: number, cellY: number, emoji: string, size = CELL - 2): void {
    const { canvas: ec, w, h } = this._emojiCache.get(emoji);
    const scale = Math.min(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    const x = cellX * CELL;
    const y = cellY * CELL;
    ctx.drawImage(ec, x + (CELL - dw) / 2, y + (CELL - dh) / 2, dw, dh);
  }

  private _drawWaterBlocks(ctx: CanvasRenderingContext2D, world: World): void {
    const drawn = new Set<string>();
    for (const wb of world.waterBlocks.values()) {
      if (drawn.has(wb.id)) continue;
      drawn.add(wb.id);
      const pct = wb.units / wb.maxUnits;
      ctx.globalAlpha = 0.4 + 0.6 * pct;
      for (const c of wb.cells) {
        this._drawCellEmoji(ctx, c.x, c.y, WORLD_EMOJIS.water);
      }
      ctx.globalAlpha = 1;
    }
  }

  private _drawTreeBlocks(ctx: CanvasRenderingContext2D, world: World): void {
    for (const tree of world.treeBlocks.values()) {
      const pct = tree.units / tree.maxUnits;
      ctx.globalAlpha = 0.4 + 0.6 * pct;
      this._drawCellEmoji(ctx, tree.x, tree.y, tree.emoji);
      ctx.globalAlpha = 1;
    }
  }

  private _drawSeedlings(ctx: CanvasRenderingContext2D, world: World): void {
    for (const s of world.seedlings.values()) {
      this._drawCellEmoji(ctx, s.x, s.y, WORLD_EMOJIS.seedling);
    }
  }

  private _drawFoodBlocks(ctx: CanvasRenderingContext2D, world: World): void {
    for (const fb of world.foodBlocks.values()) {
      const pct = fb.units / fb.maxUnits;
      ctx.globalAlpha = 0.4 + 0.6 * pct;
      this._drawCellEmoji(ctx, fb.x, fb.y, fb.emoji || FOOD_EMOJIS.lq[0]);
      ctx.globalAlpha = 1;
    }
  }

  private _drawLootBags(ctx: CanvasRenderingContext2D, world: World): void {
    for (const bag of world.lootBags.values()) {
      const fadeRatio = Math.max(0.3, bag.decayMs / TUNE.lootBag.decayMs);
      ctx.globalAlpha = fadeRatio;
      this._drawCellEmoji(ctx, bag.x, bag.y, WORLD_EMOJIS.lootBag);
      ctx.globalAlpha = 1;
    }
  }

  private _drawFarms(ctx: CanvasRenderingContext2D, world: World): void {
    for (const f of world.farms.values())
      this._drawCellEmoji(ctx, f.x, f.y, WORLD_EMOJIS.farm);
  }

  private _drawWalls(ctx: CanvasRenderingContext2D, world: World): void {
    for (const w of world.walls.values()) {
      const dmg = 1 - w.hp / w.maxHp;
      ctx.globalAlpha = dmg > 0 ? 1 - Math.min(0.7, dmg) : 1;
      this._drawCellEmoji(ctx, w.x, w.y, WORLD_EMOJIS.wall);
      ctx.globalAlpha = 1;
    }
  }

  private _drawFlags(ctx: CanvasRenderingContext2D, world: World): void {
    for (const f of world.flags.values()) {
      const faction = world.factions.get(f.factionId);
      const col = faction?.color || '#cccccc';
      const { canvas: ec, w, h } = this._emojiCache.getTinted(WORLD_EMOJIS.flag, col);
      const scale = Math.min((CELL - 2) / w, (CELL - 2) / h);
      const dw = w * scale;
      const dh = h * scale;
      const x = f.x * CELL;
      const y = f.y * CELL;
      ctx.drawImage(ec, x + (CELL - dw) / 2, y + (CELL - dh) / 2, dw, dh);
    }
  }

  private _drawAgents(ctx: CanvasRenderingContext2D, world: World, attackLines: [Agent, Agent][]): void {
    for (const agent of world.agents) {
      const t = agent.lerpT != null ? agent.lerpT : 1;
      const px = agent.prevCellX != null ? agent.prevCellX : agent.cellX;
      const py = agent.prevCellY != null ? agent.prevCellY : agent.cellY;
      const lx = px + (agent.cellX - px) * t;
      const ly = py + (agent.cellY - py) * t;
      const x = lx * CELL;
      const y = ly * CELL;

      const col = agent.factionId
        ? world.factions.get(agent.factionId)?.color || '#fff'
        : '#6b7280';
      const actionType = agent.action?.type;
      const emoji = AGENT_EMOJIS[actionType as string] || getIdleEmoji(agent);

      this._drawAgentEmoji(ctx, x, y, CELL / 2 - 3, col, emoji);

      // HP bar
      const hpw = Math.max(0, Math.floor((CELL - 6) * (agent.health / agent.maxHealth)));
      ctx.fillStyle = COLORS.hp;
      ctx.fillRect(x + 3, y - 4, hpw, 2);

      // Collect attack lines
      if (agent.action?.type === 'attack' && agent.action.payload?.targetId) {
        const t2 = world.agentsById.get(agent.action.payload.targetId);
        if (t2) attackLines.push([agent, t2]);
      }

      // Selection star
      if (world.selectedId === agent.id) this._drawStar(ctx, x + CELL / 2, y - 16);
    }
  }

  private _drawAgentEmoji(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, stroke: string, emoji: string): void {
    ctx.beginPath();
    ctx.arc(x + CELL / 2, y + CELL / 2, radius + 1, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();

    const { canvas: ec, w, h } = this._emojiCache.get(emoji);
    const drawSize = CELL - 4;
    const scale = Math.min(drawSize / w, drawSize / h);
    const dw = w * scale;
    const dh = h * scale;
    ctx.drawImage(ec, x + (CELL - dw) / 2, y + (CELL - dh) / 2, dw, dh);
  }

  private _drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const spikes = 5, outer = 6, inner = 3.2;
    let rot = (Math.PI / 2) * 3;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - outer);
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outer;
      let y = cy + Math.sin(rot) * outer;
      ctx.lineTo(x, y);
      rot += Math.PI / spikes;
      x = cx + Math.cos(rot) * inner;
      y = cy + Math.sin(rot) * inner;
      ctx.lineTo(x, y);
      rot += Math.PI / spikes;
    }
    ctx.lineTo(cx, cy - outer);
    ctx.closePath();
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#7a5f1d';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private _drawAttackLines(ctx: CanvasRenderingContext2D, camera: Camera, lines: [Agent, Agent][]): void {
    ctx.strokeStyle = COLORS.attackLine;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1 / camera.scale;
    for (const [att, tgt] of lines) {
      const at = att.lerpT != null ? att.lerpT : 1;
      const ax = ((att.prevCellX ?? att.cellX) + (att.cellX - (att.prevCellX ?? att.cellX)) * at) * CELL + CELL / 2;
      const ay = ((att.prevCellY ?? att.cellY) + (att.cellY - (att.prevCellY ?? att.cellY)) * at) * CELL + CELL / 2;
      const tt = tgt.lerpT != null ? tgt.lerpT : 1;
      const tx = ((tgt.prevCellX ?? tgt.cellX) + (tgt.cellX - (tgt.prevCellX ?? tgt.cellX)) * tt) * CELL + CELL / 2;
      const ty = ((tgt.prevCellY ?? tgt.cellY) + (tgt.cellY - (tgt.prevCellY ?? tgt.cellY)) * tt) * CELL + CELL / 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private _drawClouds(ctx: CanvasRenderingContext2D, world: World, _camera: Camera): void {
    for (const cloud of world.clouds) {
      const fadeRatio = Math.max(0, cloud.lifetimeMs / 5000);
      ctx.globalAlpha = Math.min(0.7, fadeRatio);
      this._drawCellEmoji(ctx, cloud.x, cloud.y, WORLD_EMOJIS.cloud, CELL * 2);
      ctx.globalAlpha = 1;
    }
  }
}
