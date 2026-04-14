import { CELL_PX, GRID_SIZE, COLORS, AGENT_EMOJIS, IDLE_EMOJIS, WORLD_EMOJIS, FOOD_EMOJIS } from '../../core/constants';
import { getIdleEmoji } from '../../core/utils';
import type { TerrainField } from '../world/terrain-field';
import type { World } from '../world';
import type { DeathCause } from '../world/types';
import type { Agent } from '../entity/agent';
import type { IActionState } from '../action/types';
import { evaluateNeeds } from '../decision/need-evaluator';
import { computeMood } from '../decision/mood-evaluator';
import { Camera } from './camera';
import { EmojiCache } from './emoji-cache';
import { AnimationRunner } from './animation-runner';
import { IndicatorRenderer } from './indicator-renderer';
import { ToolRenderer } from './tool-renderer';

// Inline constants that were in TUNE
const POOP_DECAY_MS = 30000;
const LOOT_BAG_DECAY_MS = 30000;

interface ViewBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const DEATH_CAUSE_EMOJI: Record<DeathCause, string> = {
  hunger: '\u{1F9B4}',   // 🦴
  killed: '\u{1FA78}',   // 🩸
  disease: '\u{1F9A0}',  // 🦠
  old_age: '\u{1F550}',  // 🕐
  tree: '\u{1FABE}',     // 🪾
};

/** Below this camera scale, world entities render as colored rectangles instead of emojis. */
const LOD_SCALE = 0.55;

const DRY_TREE_FILTER = 'saturate(0.3) sepia(0.6) brightness(0.9)';

// LOD fallback colors
const LOD_WATER   = '#4488cc';
const LOD_TREE_WET = '#3d6b2e';
const LOD_TREE_DRY = '#8B7355';
const LOD_SEEDLING = '#7ab648';
const LOD_EGG     = '#f5e6c8';
const LOD_POOP    = '#6b4226';
const LOD_FOOD    = '#c88040';
const LOD_LOOT    = '#c9a83f';
const LOD_FARM    = '#b8860b';
const LOD_OBSTACLE = '#888888';

export class Renderer {
  private readonly _emojiCache = new EmojiCache();
  private readonly _animationRunner = new AnimationRunner();
  private readonly _indicatorRenderer: IndicatorRenderer;
  private readonly _toolRenderer: ToolRenderer;

  constructor() {
    this._indicatorRenderer = new IndicatorRenderer(
      { topLeft: { source: 'faction_flag' }, topRight: { source: 'none' }, bottomMiddle: { source: 'pregnancy' } },
      this._emojiCache
    );
    this._toolRenderer = new ToolRenderer(this._emojiCache);
  }

  get indicatorRenderer(): IndicatorRenderer { return this._indicatorRenderer; }
  get animationRunner(): AnimationRunner { return this._animationRunner; }

  // --- Terrain cache ---
  private _terrainCanvas: HTMLCanvasElement | null = null;
  private _terrainCtx: CanvasRenderingContext2D | null = null;
  private _cachedTerrainVersion = -1;
  private _cachedSaltCount = -1;

  // --- Tree near-water cache ---
  private _treeNearWater = new Set<string>();
  private _cachedTreeCount = -1;
  private _cachedWaterCount = -1;

  render(world: World, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, camera: Camera): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      camera.scale, 0, 0, camera.scale,
      -camera.x * camera.scale,
      -camera.y * camera.scale
    );

    const vb = this._viewBounds(camera, canvas);
    const lod = camera.scale < LOD_SCALE;

    // Step display moisture toward target (cheap: one pass over 3844 bytes, only while transitioning)
    world.terrainField.stepDisplay();

    // Terrain + salt water: drawn from cached offscreen canvas
    const terrainDirty =
      !this._terrainCanvas ||
      this._cachedTerrainVersion !== world.terrainField.version ||
      this._cachedSaltCount !== world.saltWaterBlocks.size;

    if (terrainDirty) {
      this._rebuildTerrainCache(world);
      this._cachedTerrainVersion = world.terrainField.version;
      this._cachedSaltCount = world.saltWaterBlocks.size;
    }

    // Blit only the visible portion of the cached terrain
    const sx = Math.max(0, vb.minX * CELL_PX);
    const sy = Math.max(0, vb.minY * CELL_PX);
    const sw = (vb.maxX - vb.minX + 1) * CELL_PX;
    const sh = (vb.maxY - vb.minY + 1) * CELL_PX;
    ctx.drawImage(this._terrainCanvas!, sx, sy, sw, sh, sx, sy, sw, sh);

    if (world.drawGrid) this._drawGrid(ctx, camera, vb);
    this._drawWaterBlocks(ctx, world, vb, lod);
    this._drawTreeBlocks(ctx, world, vb, lod);
    this._drawSeedlings(ctx, world, vb, lod);
    this._drawEggs(ctx, world, vb, lod);
    this._drawPoopBlocks(ctx, world, vb, lod);
    this._drawFoodBlocks(ctx, world, vb, lod);
    this._drawLootBags(ctx, world, vb, lod);
    this._drawFarms(ctx, world, vb, lod);
    this._drawObstacles(ctx, world, vb, lod);
    this._drawFlags(ctx, world, vb, lod);

    const pendingToolLines: Array<{ agent: Agent; action: IActionState }> = [];
    this._drawAgents(ctx, world, pendingToolLines, vb);
    this._drawDeadMarkers(ctx, world, vb, lod);
    this._toolRenderer.renderAll(ctx, pendingToolLines, world);
    this._drawSelectedAgentPath(ctx, world);

    this._drawClouds(ctx, world, camera, vb, lod);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- Helpers ---

  private _viewBounds(camera: Camera, canvas: HTMLCanvasElement): ViewBounds {
    const minX = Math.max(0, Math.floor(camera.x / CELL_PX) - 1);
    const minY = Math.max(0, Math.floor(camera.y / CELL_PX) - 1);
    const maxX = Math.min(GRID_SIZE - 1, Math.ceil((camera.x + canvas.width / camera.scale) / CELL_PX));
    const maxY = Math.min(GRID_SIZE - 1, Math.ceil((camera.y + canvas.height / camera.scale) / CELL_PX));
    return { minX, minY, maxX, maxY };
  }

  private _inView(x: number, y: number, vb: ViewBounds): boolean {
    return x >= vb.minX && x <= vb.maxX && y >= vb.minY && y <= vb.maxY;
  }

  private _fillCell(ctx: CanvasRenderingContext2D, cellX: number, cellY: number, color: string, pad = 2): void {
    ctx.fillStyle = color;
    ctx.fillRect(cellX * CELL_PX + pad, cellY * CELL_PX + pad, CELL_PX - pad * 2, CELL_PX - pad * 2);
  }

  // --- Terrain cache ---

  private _rebuildTerrainCache(world: World): void {
    const size = GRID_SIZE * CELL_PX;
    if (!this._terrainCanvas || this._terrainCanvas.width !== size) {
      this._terrainCanvas = document.createElement('canvas');
      this._terrainCanvas.width = size;
      this._terrainCanvas.height = size;
      this._terrainCtx = this._terrainCanvas.getContext('2d')!;
    }
    const tc = this._terrainCtx!;
    this._drawTerrainToCtx(tc, world.terrainField);
    this._drawSaltWaterToCtx(tc, world);
  }

  private _drawTerrainToCtx(ctx: CanvasRenderingContext2D, terrainField: TerrainField): void {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const m = terrainField.moistureAt(x, y);
        let base: [number, number, number];
        if (m <= 128) {
          base = Renderer._lerpRGB(Renderer._DRY, Renderer._MUD, m / 128);
        } else {
          base = Renderer._lerpRGB(Renderer._MUD, Renderer._GRASS, (m - 128) / 127);
        }

        const h0 = Renderer._cellHash(x, y, 0);
        const variation = ((h0 & 0xff) / 255 - 0.5) * 20;
        const r = Math.max(0, Math.min(255, Math.round(base[0] + variation)));
        const g = Math.max(0, Math.min(255, Math.round(base[1] + variation)));
        const b = Math.max(0, Math.min(255, Math.round(base[2] + variation)));

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const px = x * CELL_PX;
        const py = y * CELL_PX;
        ctx.fillRect(px, py, CELL_PX, CELL_PX);

        const h1 = Renderer._cellHash(x, y, 1);
        const h2 = Renderer._cellHash(x, y, 2);
        const h3 = Renderer._cellHash(x, y, 3);
        const speckAlpha = 0.12 + (h1 & 0xf) / 100;
        const darker = ((h1 >> 8) & 1) === 0;
        ctx.fillStyle = darker
          ? `rgba(0,0,0,${speckAlpha})`
          : `rgba(255,255,255,${speckAlpha})`;

        const sx1 = px + ((h1 >> 16) & 0xf) % CELL_PX;
        const sy1 = py + ((h1 >> 20) & 0xf) % CELL_PX;
        ctx.fillRect(sx1, sy1, 2, 1);

        const sx2 = px + ((h2 >> 4) & 0xf) % CELL_PX;
        const sy2 = py + ((h2 >> 8) & 0xf) % CELL_PX;
        ctx.fillRect(sx2, sy2, 1, 2);

        if ((h3 & 3) === 0) {
          const sx3 = px + ((h3 >> 12) & 0xf) % CELL_PX;
          const sy3 = py + ((h3 >> 16) & 0xf) % CELL_PX;
          ctx.fillRect(sx3, sy3, 1, 1);
        }
      }
    }
  }

  private _drawSaltWaterToCtx(ctx: CanvasRenderingContext2D, world: World): void {
    if (world.saltWaterBlocks.size === 0) return;
    for (const sw of world.saltWaterBlocks.values()) {
      const h0 = Renderer._cellHash(sw.x, sw.y, 7);
      const variation = ((h0 & 0xff) / 255 - 0.5) * 16;
      const r = Math.max(0, Math.min(255, Math.round(Renderer._SALT[0] + variation)));
      const g = Math.max(0, Math.min(255, Math.round(Renderer._SALT[1] + variation)));
      const b = Math.max(0, Math.min(255, Math.round(Renderer._SALT[2] + variation)));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const px = sw.x * CELL_PX;
      const py = sw.y * CELL_PX;
      ctx.fillRect(px, py, CELL_PX, CELL_PX);

      const h1 = Renderer._cellHash(sw.x, sw.y, 8);
      if ((h1 & 3) < 2) {
        ctx.fillStyle = `rgba(255,255,255,0.1)`;
        const wx = px + ((h1 >> 4) & 0xf) % (CELL_PX - 3);
        const wy = py + ((h1 >> 12) & 0xf) % CELL_PX;
        ctx.fillRect(wx, wy, 3, 1);
      }
    }
  }

  // --- Grid ---

  private _drawGrid(ctx: CanvasRenderingContext2D, camera: Camera, vb: ViewBounds): void {
    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1 / camera.scale;
    ctx.beginPath();
    for (let i = vb.minY; i <= vb.maxY + 1; i++) {
      const y = i * CELL_PX + 0.5;
      ctx.moveTo(vb.minX * CELL_PX, y);
      ctx.lineTo((vb.maxX + 1) * CELL_PX, y);
    }
    for (let i = vb.minX; i <= vb.maxX + 1; i++) {
      const x = i * CELL_PX + 0.5;
      ctx.moveTo(x, vb.minY * CELL_PX);
      ctx.lineTo(x, (vb.maxY + 1) * CELL_PX);
    }
    ctx.stroke();
    ctx.restore();
  }

  // --- Static helpers ---

  private static _cellHash(x: number, y: number, seed: number): number {
    let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
    h = ((h ^ (h >> 13)) * 1103515245) | 0;
    return (h ^ (h >> 16)) >>> 0;
  }

  private static _lerpRGB(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
    return [
      c1[0] + (c2[0] - c1[0]) * t,
      c1[1] + (c2[1] - c1[1]) * t,
      c1[2] + (c2[2] - c1[2]) * t,
    ];
  }

  private static readonly _DRY: [number, number, number] = [0xC4, 0xA9, 0x46];
  private static readonly _MUD: [number, number, number] = [0x8B, 0x73, 0x55];
  private static readonly _GRASS: [number, number, number] = [0x5C, 0x7A, 0x3A];
  private static readonly _SALT: [number, number, number] = [0x2B, 0x5A, 0x7B];

  // --- Entity drawing (with viewport culling + LOD) ---

  private _drawCellEmoji(ctx: CanvasRenderingContext2D, cellX: number, cellY: number, emoji: string, size = CELL_PX - 2): void {
    const { canvas: ec, w, h } = this._emojiCache.get(emoji);
    const scale = Math.min(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    const x = cellX * CELL_PX;
    const y = cellY * CELL_PX;
    ctx.drawImage(ec, x + (CELL_PX - dw) / 2, y + (CELL_PX - dh) / 2, dw, dh);
  }

  private _drawWaterBlocks(ctx: CanvasRenderingContext2D, world: World, vb: ViewBounds, lod: boolean): void {
    const drawn = new Set<string>();
    for (const wb of world.waterBlocks.values()) {
      if (drawn.has(wb.id)) continue;
      drawn.add(wb.id);
      let visible = false;
      for (const c of wb.cells) {
        if (this._inView(c.x, c.y, vb)) { visible = true; break; }
      }
      if (!visible) continue;
      const pct = wb.units / wb.maxUnits;
      ctx.globalAlpha = 0.4 + 0.6 * pct;
      for (const c of wb.cells) {
        if (lod) {
          this._fillCell(ctx, c.x, c.y, LOD_WATER, 0);
        } else {
          this._drawCellEmoji(ctx, c.x, c.y, WORLD_EMOJIS.water);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  private _drawTreeBlocks(ctx: CanvasRenderingContext2D, world: World, vb: ViewBounds, lod: boolean): void {
    // Rebuild near-water lookup when tree or water counts change
    const treeCount = world.treeBlocks.size;
    const waterCount = world.waterBlocks.size;
    if (treeCount !== this._cachedTreeCount || waterCount !== this._cachedWaterCount) {
      this._cachedTreeCount = treeCount;
      this._cachedWaterCount = waterCount;
      this._treeNearWater.clear();
      for (const tree of world.treeBlocks.values()) {
        for (const wb of world.waterBlocks.values()) {
          if (Math.abs(tree.x - wb.x) + Math.abs(tree.y - wb.y) <= 5) {
            this._treeNearWater.add(`${tree.x},${tree.y}`);
            break;
          }
        }
      }
    }

    for (const tree of world.treeBlocks.values()) {
      if (!this._inView(tree.x, tree.y, vb)) continue;
      const pct = tree.units / tree.maxUnits;
      ctx.globalAlpha = 0.4 + 0.6 * pct;
      const nearWater = this._treeNearWater.has(`${tree.x},${tree.y}`);
      if (lod) {
        this._fillCell(ctx, tree.x, tree.y, nearWater ? LOD_TREE_WET : LOD_TREE_DRY, 1);
      } else if (nearWater) {
        this._drawCellEmoji(ctx, tree.x, tree.y, tree.emoji);
      } else {
        // Pre-cached filtered emoji — no per-frame ctx.filter
        const { canvas: ec, w, h } = this._emojiCache.getFiltered(tree.emoji, DRY_TREE_FILTER);
        const size = CELL_PX - 2;
        const scale = Math.min(size / w, size / h);
        const dw = w * scale;
        const dh = h * scale;
        const x = tree.x * CELL_PX;
        const y = tree.y * CELL_PX;
        ctx.drawImage(ec, x + (CELL_PX - dw) / 2, y + (CELL_PX - dh) / 2, dw, dh);
      }
      ctx.globalAlpha = 1;
    }
  }

  private _drawSeedlings(ctx: CanvasRenderingContext2D, world: World, vb: ViewBounds, lod: boolean): void {
    for (const s of world.seedlings.values()) {
      if (!this._inView(s.x, s.y, vb)) continue;
      if (lod) {
        this._fillCell(ctx, s.x, s.y, LOD_SEEDLING, 4);
      } else {
        this._drawCellEmoji(ctx, s.x, s.y, WORLD_EMOJIS.seedling, CELL_PX / 2);
      }
    }
  }

  private _drawEggs(ctx: CanvasRenderingContext2D, world: World, vb: ViewBounds, lod: boolean): void {
    for (const egg of world.eggs.values()) {
      if (!this._inView(egg.x, egg.y, vb)) continue;
      if (lod) {
        this._fillCell(ctx, egg.x, egg.y, LOD_EGG, 3);
      } else {
        this._drawCellEmoji(ctx, egg.x, egg.y, WORLD_EMOJIS.egg);
      }
    }
  }

  private _drawPoopBlocks(ctx: CanvasRenderingContext2D, world: World, vb: ViewBounds, lod: boolean): void {
    for (const poop of world.poopBlocks.values()) {
      if (!this._inView(poop.x, poop.y, vb)) continue;
      const fadeRatio = Math.max(0.3, poop.decayMs / POOP_DECAY_MS);
      ctx.globalAlpha = fadeRatio;
      if (lod) {
        this._fillCell(ctx, poop.x, poop.y, LOD_POOP, 4);
      } else {
        this._drawCellEmoji(ctx, poop.x, poop.y, WORLD_EMOJIS.poop, CELL_PX / 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  private _drawFoodBlocks(ctx: CanvasRenderingContext2D, world: World, vb: ViewBounds, lod: boolean): void {
    for (const fb of world.foodBlocks.values()) {
      if (!this._inView(fb.x, fb.y, vb)) continue;
      const pct = fb.units / fb.maxUnits;
      ctx.globalAlpha = 0.4 + 0.6 * pct;
      if (lod) {
        this._fillCell(ctx, fb.x, fb.y, LOD_FOOD, 4);
      } else {
        this._drawCellEmoji(ctx, fb.x, fb.y, fb.emoji || FOOD_EMOJIS.lq[0], CELL_PX / 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  private _drawLootBags(ctx: CanvasRenderingContext2D, world: World, vb: ViewBounds, lod: boolean): void {
    for (const bag of world.lootBags.values()) {
      if (!this._inView(bag.x, bag.y, vb)) continue;
      const fadeRatio = Math.max(0.3, bag.decayMs / LOOT_BAG_DECAY_MS);
      ctx.globalAlpha = fadeRatio;
      if (lod) {
        this._fillCell(ctx, bag.x, bag.y, LOD_LOOT, 3);
      } else {
        this._drawCellEmoji(ctx, bag.x, bag.y, WORLD_EMOJIS.lootBag);
      }
      ctx.globalAlpha = 1;
    }
  }

  private _drawFarms(ctx: CanvasRenderingContext2D, world: World, vb: ViewBounds, lod: boolean): void {
    for (const f of world.farms.values()) {
      if (!this._inView(f.x, f.y, vb)) continue;
      if (lod) {
        this._fillCell(ctx, f.x, f.y, LOD_FARM, 1);
      } else {
        this._drawCellEmoji(ctx, f.x, f.y, WORLD_EMOJIS.farm);
      }
    }
  }

  private _drawObstacles(ctx: CanvasRenderingContext2D, world: World, vb: ViewBounds, lod: boolean): void {
    const drawn = new Set<string>();
    for (const o of world.obstacles.values()) {
      if (drawn.has(o.id)) continue;
      drawn.add(o.id);
      if (o.size === '2x2') {
        if (!this._inView(o.x, o.y, vb) && !this._inView(o.x + 1, o.y, vb) &&
            !this._inView(o.x, o.y + 1, vb) && !this._inView(o.x + 1, o.y + 1, vb)) continue;
      } else {
        if (!this._inView(o.x, o.y, vb)) continue;
      }
      const dmg = 1 - o.hp / o.maxHp;
      ctx.globalAlpha = dmg > 0 ? 1 - Math.min(0.7, dmg) : 1;
      if (lod) {
        this._fillCell(ctx, o.x, o.y, LOD_OBSTACLE, 0);
        if (o.size === '2x2') {
          this._fillCell(ctx, o.x + 1, o.y, LOD_OBSTACLE, 0);
          this._fillCell(ctx, o.x, o.y + 1, LOD_OBSTACLE, 0);
          this._fillCell(ctx, o.x + 1, o.y + 1, LOD_OBSTACLE, 0);
        }
      } else if (o.size === '2x2') {
        const { canvas: ec, w, h } = this._emojiCache.get(o.emoji);
        const drawSize = CELL_PX * 2 - 2;
        const scale = Math.min(drawSize / w, drawSize / h);
        const dw = w * scale;
        const dh = h * scale;
        const bx = o.x * CELL_PX;
        const by = o.y * CELL_PX;
        ctx.drawImage(ec, bx + (CELL_PX * 2 - dw) / 2, by + (CELL_PX * 2 - dh) / 2, dw, dh);
      } else {
        this._drawCellEmoji(ctx, o.x, o.y, o.emoji);
      }
      ctx.globalAlpha = 1;
    }
  }

  private _drawFlags(ctx: CanvasRenderingContext2D, world: World, vb: ViewBounds, lod: boolean): void {
    for (const f of world.flags.values()) {
      if (!this._inView(f.x, f.y, vb)) continue;
      const faction = world.factions.get(f.factionId);
      const col = faction?.color || '#cccccc';
      if (lod) {
        this._fillCell(ctx, f.x, f.y, col, 2);
      } else {
        const { canvas: ec, w, h } = this._emojiCache.getTinted(WORLD_EMOJIS.flag, col);
        const scale = Math.min((CELL_PX - 2) / w, (CELL_PX - 2) / h);
        const dw = w * scale;
        const dh = h * scale;
        const x = f.x * CELL_PX;
        const y = f.y * CELL_PX;
        ctx.drawImage(ec, x + (CELL_PX - dw) / 2, y + (CELL_PX - dh) / 2, dw, dh);
      }
    }
  }

  // --- Agents (always full detail — they're the star of the show) ---

  private _hpToColor(ratio: number): string {
    const hue = Math.round(ratio * 120);
    return `hsl(${hue}, 85%, 50%)`;
  }

  private _drawAgents(ctx: CanvasRenderingContext2D, world: World, toolLines: Array<{ agent: Agent; action: IActionState }>, vb: ViewBounds): void {
    const now = performance.now();
    for (const agent of world.agents) {
      if (!this._inView(agent.cellX, agent.cellY, vb) &&
          !this._inView(agent.prevCellX ?? agent.cellX, agent.prevCellY ?? agent.cellY, vb)) continue;

      const t = agent.lerpT != null ? agent.lerpT : 1;
      const px = agent.prevCellX != null ? agent.prevCellX : agent.cellX;
      const py = agent.prevCellY != null ? agent.prevCellY : agent.cellY;
      const lx = px + (agent.cellX - px) * t;
      const ly = py + (agent.cellY - py) * t;
      const x = lx * CELL_PX;
      const y = ly * CELL_PX;
      const cx = x + CELL_PX / 2;
      const cy = y + CELL_PX / 2;

      const hpRatio = agent.maxHealth > 0 ? Math.max(0, Math.min(1, agent.health / agent.maxHealth)) : 0;
      const ringColor = this._hpToColor(hpRatio);
      const actionType = agent.action?.type;
      let emoji: string;
      if (agent.babyMsRemaining > 0 && (actionType === 'eat' || actionType === 'wash')) {
        emoji = IDLE_EMOJIS.babyEating;
      } else if (AGENT_EMOJIS[actionType as string]) {
        emoji = AGENT_EMOJIS[actionType as string];
      } else if (agent.matingTargetId) {
        emoji = AGENT_EMOJIS['seek_mate'] || '\u{1F495}';
      } else {
        const mood = computeMood(evaluateNeeds(agent));
        emoji = getIdleEmoji(agent, mood);
      }

      const transform = this._animationRunner.getTransform(agent);
      let rotation = transform.rotation;
      const isMoving = t < 1 && (agent.prevCellX !== agent.cellX || agent.prevCellY !== agent.cellY);
      if (isMoving) {
        const ddx = agent.cellX - (agent.prevCellX ?? agent.cellX);
        const ddy = agent.cellY - (agent.prevCellY ?? agent.cellY);
        const tilt = 0.25;
        rotation = Math.atan2(ddy, ddx) + Math.PI / 2 + Math.sin(now * 0.015) * tilt;
      }

      ctx.save();
      ctx.translate(cx + transform.dx, cy + transform.dy);
      if (rotation !== 0) ctx.rotate(rotation);
      if (transform.scale !== 1) ctx.scale(transform.scale, transform.scale);
      ctx.translate(-cx, -cy);
      this._drawAgentEmoji(ctx, x, y, CELL_PX / 2 - 3, ringColor, emoji);
      ctx.restore();

      this._indicatorRenderer.render(ctx, agent, x, y, world);

      if (agent.action) toolLines.push({ agent, action: agent.action });

      if (world.selectedId === agent.id) this._drawStar(ctx, x + CELL_PX / 2, y - 16);
    }
  }

  private _drawAgentEmoji(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, stroke: string, emoji: string): void {
    ctx.beginPath();
    ctx.arc(x + CELL_PX / 2, y + CELL_PX / 2, radius + 1, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();

    const { canvas: ec, w, h } = this._emojiCache.get(emoji);
    const drawSize = CELL_PX - 4;
    const scale = Math.min(drawSize / w, drawSize / h);
    const dw = w * scale;
    const dh = h * scale;
    ctx.drawImage(ec, x + (CELL_PX - dw) / 2, y + (CELL_PX - dh) / 2, dw, dh);
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

  // --- Death markers ---

  private _drawDeadMarkers(ctx: CanvasRenderingContext2D, world: World, vb: ViewBounds, lod: boolean): void {
    for (const marker of world.deadMarkers) {
      if (!this._inView(marker.cellX, marker.cellY, vb)) continue;
      const x = marker.cellX * CELL_PX;
      const y = marker.cellY * CELL_PX;
      const fade = Math.min(1, marker.msRemaining / 3000);
      ctx.globalAlpha = fade;

      if (lod) {
        ctx.fillStyle = '#cc2222';
        ctx.fillRect(x + 4, y + 4, CELL_PX - 8, CELL_PX - 8);
      } else if (marker.cause === 'tree') {
        const stumpEmoji = DEATH_CAUSE_EMOJI.tree;
        const { canvas: sc, w: sw, h: sh } = this._emojiCache.get(stumpEmoji);
        const drawSize = CELL_PX - 2;
        const scale = Math.min(drawSize / sw, drawSize / sh);
        ctx.drawImage(sc, x + (CELL_PX - sw * scale) / 2, y + (CELL_PX - sh * scale) / 2, sw * scale, sh * scale);
      } else {
        const deadEmoji = '\u{1F635}'; // 😵
        const { canvas: ec, w, h } = this._emojiCache.get(deadEmoji);
        const drawSize = CELL_PX - 4;
        const scale = Math.min(drawSize / w, drawSize / h);
        ctx.drawImage(ec, x + (CELL_PX - w * scale) / 2, y + (CELL_PX - h * scale) / 2, w * scale, h * scale);

        const causeEmoji = DEATH_CAUSE_EMOJI[marker.cause];
        const { canvas: cc, w: cw, h: ch } = this._emojiCache.get(causeEmoji);
        const causeSize = CELL_PX / 4;
        const cScale = Math.min(causeSize / cw, causeSize / ch);
        ctx.drawImage(cc, x + CELL_PX - cw * cScale - 1, y + 1, cw * cScale, ch * cScale);
      }

      ctx.globalAlpha = 1;
    }
  }

  // --- Clouds ---

  private _drawClouds(ctx: CanvasRenderingContext2D, world: World, _camera: Camera, vb: ViewBounds, lod: boolean): void {
    const now = performance.now();
    for (const cloud of world.clouds) {
      const total = cloud.totalLifetimeMs || 7500;
      const progress = Math.min(1, (now - cloud.spawnedAtMs) / total);

      const totalDrift = cloud.decorative ? 4 : 3;
      let xDisp: number;
      if (progress <= 0.35) {
        xDisp = (progress / 0.35) * 0.40 * totalDrift;
      } else if (progress <= 0.65) {
        xDisp = 0.40 * totalDrift + ((progress - 0.35) / 0.30) * 0.20 * totalDrift;
      } else {
        xDisp = 0.60 * totalDrift + ((progress - 0.65) / 0.35) * 0.40 * totalDrift;
      }
      const xF = cloud.x + xDisp;

      const cloudCellX = Math.round(xF);
      const cloudCellY = Math.round(cloud.y);
      if (cloudCellX < vb.minX - 3 || cloudCellX > vb.maxX + 3 ||
          cloudCellY < vb.minY - 3 || cloudCellY > vb.maxY + 3) continue;

      let alpha: number;
      if (progress < 0.25) alpha = progress / 0.25;
      else if (progress < 0.75) alpha = 1;
      else alpha = (1 - progress) / 0.25;

      const maxAlpha = cloud.decorative ? 0.55 : 0.65;
      const emoji = cloud.decorative ? '\u2601\uFE0F' : WORLD_EMOJIS.cloud; // ☁️ vs 🌧️

      if (lod) {
        // Simplified cloud: single semi-transparent rectangle
        ctx.globalAlpha = Math.max(0, alpha) * maxAlpha * 0.5;
        ctx.fillStyle = cloud.decorative ? '#dddddd' : '#aabbcc';
        const px = xF * CELL_PX;
        const py = cloud.y * CELL_PX;
        ctx.fillRect(px - CELL_PX, py - CELL_PX * 0.5, CELL_PX * 3, CELL_PX * 1.5);
        ctx.globalAlpha = 1;
        continue;
      }

      const shadowAlpha = Math.max(0, alpha) * (cloud.decorative ? 0.08 : 0.12);
      ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
      const sx = xF * CELL_PX - CELL_PX * 0.5;
      const sy = (cloud.y + 2) * CELL_PX;
      ctx.beginPath();
      ctx.ellipse(sx + CELL_PX * 1.5, sy + CELL_PX * 0.4, CELL_PX * 1.8, CELL_PX * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = Math.max(0, alpha) * maxAlpha;
      this._drawCloudAt(ctx, xF, cloud.y, CELL_PX * 2, emoji);
      ctx.globalAlpha = Math.max(0, alpha) * maxAlpha * 0.6;
      this._drawCloudAt(ctx, xF - 1, cloud.y, CELL_PX * 1.6, emoji);
      this._drawCloudAt(ctx, xF + 1, cloud.y - 1, CELL_PX * 1.6, emoji);
      ctx.globalAlpha = 1;
    }
  }

  private _drawCloudAt(ctx: CanvasRenderingContext2D, xF: number, y: number, size: number, emoji: string = WORLD_EMOJIS.cloud): void {
    const { canvas: ec, w, h } = this._emojiCache.get(emoji);
    const scale = Math.min(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    const px = xF * CELL_PX;
    const py = y * CELL_PX;
    ctx.drawImage(ec, px + (CELL_PX - dw) / 2, py + (CELL_PX - dh) / 2, dw, dh);
  }

  // --- Selected agent path ---

  private _drawSelectedAgentPath(ctx: CanvasRenderingContext2D, world: World): void {
    if (!world.selectedId) return;
    const agent = world.agentsById.get(world.selectedId);
    if (!agent || !agent.path || agent.path.length === 0) return;
    const remaining = agent.path.slice(agent.pathIdx);
    if (remaining.length === 0) return;

    const t = agent.lerpT != null ? agent.lerpT : 1;
    const px = agent.prevCellX != null ? agent.prevCellX : agent.cellX;
    const py = agent.prevCellY != null ? agent.prevCellY : agent.cellY;
    const lx = px + (agent.cellX - px) * t;
    const ly = py + (agent.cellY - py) * t;

    ctx.save();
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.65;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    const cx = lx * CELL_PX + CELL_PX / 2;
    const cy = ly * CELL_PX + CELL_PX / 2;
    const ringRadius = CELL_PX / 2 - 2;
    const firstPos = remaining[0];
    const fdx = firstPos.x * CELL_PX + CELL_PX / 2 - cx;
    const fdy = firstPos.y * CELL_PX + CELL_PX / 2 - cy;
    const fdist = Math.sqrt(fdx * fdx + fdy * fdy);
    const startX = fdist > 0 ? cx + (fdx / fdist) * ringRadius : cx;
    const startY = fdist > 0 ? cy + (fdy / fdist) * ringRadius : cy;
    ctx.moveTo(startX, startY);
    for (const pos of remaining) {
      ctx.lineTo(pos.x * CELL_PX + CELL_PX / 2, pos.y * CELL_PX + CELL_PX / 2);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const goalPos = agent.goal ?? remaining[remaining.length - 1];
    if (goalPos) {
      ctx.globalAlpha = 0.9;
      this._drawCellEmoji(ctx, goalPos.x, goalPos.y, '\uD83D\uDCCD', CELL_PX - 2);
      ctx.globalAlpha = 1;
    }
  }
}
