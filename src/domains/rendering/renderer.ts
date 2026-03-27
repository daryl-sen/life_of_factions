import { CELL, GRID, COLORS, AGENT_EMOJIS, IDLE_EMOJIS, WORLD_EMOJIS, FOOD_EMOJIS, TUNE } from '../../shared/constants';
import type { TerrainField } from '../world/terrain-field';
import { getIdleEmoji } from '../../shared/utils';
import type { World, DeathCause } from '../world';
import type { Agent } from '../agent';
import { Camera } from './camera';
import { EmojiCache } from './emoji-cache';

const DEATH_CAUSE_EMOJI: Record<DeathCause, string> = {
  hunger: '\u{1F9B4}',   // 🦴
  killed: '\u{1FA78}',   // 🩸
  disease: '\u{1F9A0}',  // 🦠
  old_age: '\u{1F550}',  // 🕐
  tree: '\u{1FABE}',     // 🪾
};

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

    this._drawTerrain(ctx, world.terrainField);
    this._drawSaltWater(ctx, world);
    if (world.drawGrid) this._drawGrid(ctx, camera);
    this._drawWaterBlocks(ctx, world);
    this._drawTreeBlocks(ctx, world);
    this._drawSeedlings(ctx, world);
    this._drawEggs(ctx, world);
    this._drawPoopBlocks(ctx, world);
    this._drawFoodBlocks(ctx, world);
    this._drawLootBags(ctx, world);
    this._drawFarms(ctx, world);
    this._drawObstacles(ctx, world);
    this._drawFlags(ctx, world);

    const pendingAttackLines: [Agent, Agent][] = [];
    this._drawAgents(ctx, world, pendingAttackLines);
    this._drawDeadMarkers(ctx, world);
    this._drawAttackLines(ctx, camera, pendingAttackLines);
    this._drawSelectedAgentPath(ctx, world);

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

  /** Deterministic hash for consistent per-cell texture */
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

  // Pre-parsed terrain color RGB values
  private static readonly _DRY: [number, number, number] = [0xC4, 0xA9, 0x46];
  private static readonly _MUD: [number, number, number] = [0x8B, 0x73, 0x55];
  private static readonly _GRASS: [number, number, number] = [0x5C, 0x7A, 0x3A];
  private static readonly _SALT: [number, number, number] = [0x2B, 0x5A, 0x7B];

  private _drawTerrain(ctx: CanvasRenderingContext2D, terrainField: TerrainField): void {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const m = terrainField.moistureAt(x, y);
        let base: [number, number, number];
        if (m <= 128) {
          base = Renderer._lerpRGB(Renderer._DRY, Renderer._MUD, m / 128);
        } else {
          base = Renderer._lerpRGB(Renderer._MUD, Renderer._GRASS, (m - 128) / 127);
        }

        // Per-cell brightness variation from hash
        const h0 = Renderer._cellHash(x, y, 0);
        const variation = ((h0 & 0xff) / 255 - 0.5) * 20; // ±10 brightness
        const r = Math.max(0, Math.min(255, Math.round(base[0] + variation)));
        const g = Math.max(0, Math.min(255, Math.round(base[1] + variation)));
        const b = Math.max(0, Math.min(255, Math.round(base[2] + variation)));

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const px = x * CELL;
        const py = y * CELL;
        ctx.fillRect(px, py, CELL, CELL);

        // Texture details: 2-3 small specks per cell for grain
        const h1 = Renderer._cellHash(x, y, 1);
        const h2 = Renderer._cellHash(x, y, 2);
        const h3 = Renderer._cellHash(x, y, 3);
        const speckAlpha = 0.12 + (h1 & 0xf) / 100; // 0.12-0.27
        const darker = ((h1 >> 8) & 1) === 0;
        ctx.fillStyle = darker
          ? `rgba(0,0,0,${speckAlpha})`
          : `rgba(255,255,255,${speckAlpha})`;

        // Speck 1
        const sx1 = px + ((h1 >> 16) & 0xf) % CELL;
        const sy1 = py + ((h1 >> 20) & 0xf) % CELL;
        ctx.fillRect(sx1, sy1, 2, 1);

        // Speck 2
        const sx2 = px + ((h2 >> 4) & 0xf) % CELL;
        const sy2 = py + ((h2 >> 8) & 0xf) % CELL;
        ctx.fillRect(sx2, sy2, 1, 2);

        // Speck 3 (only on some cells)
        if ((h3 & 3) === 0) {
          const sx3 = px + ((h3 >> 12) & 0xf) % CELL;
          const sy3 = py + ((h3 >> 16) & 0xf) % CELL;
          ctx.fillRect(sx3, sy3, 1, 1);
        }
      }
    }
  }

  private _drawSaltWater(ctx: CanvasRenderingContext2D, world: World): void {
    if (world.saltWaterBlocks.size === 0) return;
    for (const sw of world.saltWaterBlocks.values()) {
      const h0 = Renderer._cellHash(sw.x, sw.y, 7);
      const variation = ((h0 & 0xff) / 255 - 0.5) * 16; // ±8 brightness
      const r = Math.max(0, Math.min(255, Math.round(Renderer._SALT[0] + variation)));
      const g = Math.max(0, Math.min(255, Math.round(Renderer._SALT[1] + variation)));
      const b = Math.max(0, Math.min(255, Math.round(Renderer._SALT[2] + variation)));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const px = sw.x * CELL;
      const py = sw.y * CELL;
      ctx.fillRect(px, py, CELL, CELL);

      // Subtle wave-like highlights
      const h1 = Renderer._cellHash(sw.x, sw.y, 8);
      if ((h1 & 3) < 2) {
        ctx.fillStyle = `rgba(255,255,255,0.1)`;
        const wx = px + ((h1 >> 4) & 0xf) % (CELL - 3);
        const wy = py + ((h1 >> 12) & 0xf) % CELL;
        ctx.fillRect(wx, wy, 3, 1);
      }
    }
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
      let nearWater = false;
      for (const wb of world.waterBlocks.values()) {
        if (Math.abs(tree.x - wb.x) + Math.abs(tree.y - wb.y) <= 5) { nearWater = true; break; }
      }
      if (!nearWater) ctx.filter = 'saturate(0.3) sepia(0.6) brightness(0.9)';
      this._drawCellEmoji(ctx, tree.x, tree.y, tree.emoji);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    }
  }

  private _drawSeedlings(ctx: CanvasRenderingContext2D, world: World): void {
    for (const s of world.seedlings.values()) {
      this._drawCellEmoji(ctx, s.x, s.y, WORLD_EMOJIS.seedling, CELL / 2);
    }
  }

  private _drawEggs(ctx: CanvasRenderingContext2D, world: World): void {
    for (const egg of world.eggs.values()) {
      this._drawCellEmoji(ctx, egg.x, egg.y, WORLD_EMOJIS.egg);
    }
  }

  private _drawPoopBlocks(ctx: CanvasRenderingContext2D, world: World): void {
    for (const poop of world.poopBlocks.values()) {
      const fadeRatio = Math.max(0.3, poop.decayMs / TUNE.poop.decayMs);
      ctx.globalAlpha = fadeRatio;
      this._drawCellEmoji(ctx, poop.x, poop.y, WORLD_EMOJIS.poop, CELL / 2);
      ctx.globalAlpha = 1;
    }
  }

  private _drawFoodBlocks(ctx: CanvasRenderingContext2D, world: World): void {
    for (const fb of world.foodBlocks.values()) {
      const pct = fb.units / fb.maxUnits;
      ctx.globalAlpha = 0.4 + 0.6 * pct;
      this._drawCellEmoji(ctx, fb.x, fb.y, fb.emoji || FOOD_EMOJIS.lq[0], CELL / 2);
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

  private _drawObstacles(ctx: CanvasRenderingContext2D, world: World): void {
    const drawn = new Set<string>();
    for (const o of world.obstacles.values()) {
      if (drawn.has(o.id)) continue;
      drawn.add(o.id);
      const dmg = 1 - o.hp / o.maxHp;
      ctx.globalAlpha = dmg > 0 ? 1 - Math.min(0.7, dmg) : 1;
      if (o.size === '2x2') {
        // Draw one large emoji centered on the 2x2 block
        const { canvas: ec, w, h } = this._emojiCache.get(o.emoji);
        const drawSize = CELL * 2 - 2;
        const scale = Math.min(drawSize / w, drawSize / h);
        const dw = w * scale;
        const dh = h * scale;
        const bx = o.x * CELL;
        const by = o.y * CELL;
        ctx.drawImage(ec, bx + (CELL * 2 - dw) / 2, by + (CELL * 2 - dh) / 2, dw, dh);
      } else {
        this._drawCellEmoji(ctx, o.x, o.y, o.emoji);
      }
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

  private _hpToColor(ratio: number): string {
    // Green (120°) at full HP → Red (0°) at zero HP
    const hue = Math.round(ratio * 120);
    return `hsl(${hue}, 85%, 50%)`;
  }

  private _drawAgents(ctx: CanvasRenderingContext2D, world: World, attackLines: [Agent, Agent][]): void {
    const now = performance.now();
    for (const agent of world.agents) {
      const t = agent.lerpT != null ? agent.lerpT : 1;
      const px = agent.prevCellX != null ? agent.prevCellX : agent.cellX;
      const py = agent.prevCellY != null ? agent.prevCellY : agent.cellY;
      const lx = px + (agent.cellX - px) * t;
      const ly = py + (agent.cellY - py) * t;
      const x = lx * CELL;
      const y = ly * CELL;
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;

      const hpRatio = agent.maxHealth > 0 ? Math.max(0, Math.min(1, agent.health / agent.maxHealth)) : 0;
      const ringColor = this._hpToColor(hpRatio);
      const actionType = agent.action?.type;
      let emoji: string;
      if (agent.babyMsRemaining > 0 && (actionType === 'eat' || actionType === 'drink')) {
        emoji = IDLE_EMOJIS.babyEating;
      } else {
        emoji = AGENT_EMOJIS[actionType as string] || getIdleEmoji(agent);
      }

      // Compute action animation transform
      let offX = 0, offY = 0, angle = 0, sx = 1, sy = 1;
      const rem = agent.action?.remainingMs ?? 0;

      if (actionType === 'attack') {
        offX = Math.sin(now * 0.038) * 2.5;
      } else if (actionType === 'harvest') {
        offY = -Math.abs(Math.sin(now * 0.007)) * 3;
      } else if (actionType === 'poop') {
        const elapsed = now - (agent.action!.startedAtMs ?? now);
        const progress = Math.min(1, elapsed / (agent.action!.totalMs || 1500));
        if (progress < 0.7) {
          const eased = Math.sin((progress / 0.7) * Math.PI / 2);
          sy = 1 - 0.38 * eased;
        } else {
          const eased = Math.sin(((progress - 0.7) / 0.3) * Math.PI / 2);
          sy = 0.62 + 0.38 * eased;
        }
        offY = (1 - sy) * (CELL / 2); // anchor to bottom
      } else if (actionType === 'share') {
        offX = Math.sin(now * 0.005) * 2;
      }

      // Rotation while moving between cells
      const isMoving = t < 1 && (agent.prevCellX !== agent.cellX || agent.prevCellY !== agent.cellY);
      if (isMoving) {
        const ddx = agent.cellX - (agent.prevCellX ?? agent.cellX);
        const ddy = agent.cellY - (agent.prevCellY ?? agent.cellY);
        const tilt = 0.25; // ~14° max lean
        angle = Math.atan2(ddy, ddx) + Math.PI / 2 + Math.sin(now * 0.015) * tilt;
      }

      ctx.save();
      ctx.translate(cx + offX, cy + offY);
      if (angle !== 0) ctx.rotate(angle);
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
      ctx.translate(-cx, -cy);
      this._drawAgentEmoji(ctx, x, y, CELL / 2 - 3, ringColor, emoji);
      ctx.restore();

      // Faction flag and other overlays drawn without transform
      if (agent.factionId) {
        const faction = world.factions.get(agent.factionId);
        if (faction) {
          const { canvas: fc, w: fw, h: fh } = this._emojiCache.getTinted(WORLD_EMOJIS.flag, faction.color);
          const flagSize = CELL / 3;
          const fScale = Math.min(flagSize / fw, flagSize / fh);
          const fdw = fw * fScale;
          const fdh = fh * fScale;
          ctx.drawImage(fc, x + CELL - fdw, y, fdw, fdh);
        }
      }

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

  private _drawDeadMarkers(ctx: CanvasRenderingContext2D, world: World): void {
    for (const marker of world.deadMarkers) {
      const x = marker.cellX * CELL;
      const y = marker.cellY * CELL;
      const fade = Math.min(1, marker.msRemaining / 3000);
      ctx.globalAlpha = fade;

      if (marker.cause === 'tree') {
        // Tree death: show stump emoji at full cell size
        const stumpEmoji = DEATH_CAUSE_EMOJI.tree;
        const { canvas: sc, w: sw, h: sh } = this._emojiCache.get(stumpEmoji);
        const drawSize = CELL - 2;
        const scale = Math.min(drawSize / sw, drawSize / sh);
        ctx.drawImage(sc, x + (CELL - sw * scale) / 2, y + (CELL - sh * scale) / 2, sw * scale, sh * scale);
      } else {
        // Agent death: draw 😵 at full agent size
        const deadEmoji = '\u{1F635}'; // 😵
        const { canvas: ec, w, h } = this._emojiCache.get(deadEmoji);
        const drawSize = CELL - 4;
        const scale = Math.min(drawSize / w, drawSize / h);
        ctx.drawImage(ec, x + (CELL - w * scale) / 2, y + (CELL - h * scale) / 2, w * scale, h * scale);

        // Draw cause icon at 1/4 size, offset to top-right
        const causeEmoji = DEATH_CAUSE_EMOJI[marker.cause];
        const { canvas: cc, w: cw, h: ch } = this._emojiCache.get(causeEmoji);
        const causeSize = CELL / 4;
        const cScale = Math.min(causeSize / cw, causeSize / ch);
        ctx.drawImage(cc, x + CELL - cw * cScale - 1, y + 1, cw * cScale, ch * cScale);
      }

      ctx.globalAlpha = 1;
    }
  }

  private _drawAttackLines(ctx: CanvasRenderingContext2D, _camera: Camera, lines: [Agent, Agent][]): void {
    const daggerEmoji = '\uD83D\uDDE1\uFE0F'; // 🗡️
    const { canvas: ec, w, h } = this._emojiCache.get(daggerEmoji);
    const daggerSize = CELL - 2;
    const scale = Math.min(daggerSize / w, daggerSize / h);
    const dw = w * scale;
    const dh = h * scale;

    for (const [att, tgt] of lines) {
      const at = att.lerpT != null ? att.lerpT : 1;
      const ax = ((att.prevCellX ?? att.cellX) + (att.cellX - (att.prevCellX ?? att.cellX)) * at) * CELL + CELL / 2;
      const ay = ((att.prevCellY ?? att.cellY) + (att.cellY - (att.prevCellY ?? att.cellY)) * at) * CELL + CELL / 2;
      const tt = tgt.lerpT != null ? tgt.lerpT : 1;
      const tx = ((tgt.prevCellX ?? tgt.cellX) + (tgt.cellX - (tgt.prevCellX ?? tgt.cellX)) * tt) * CELL + CELL / 2;
      const ty = ((tgt.prevCellY ?? tgt.cellY) + (tgt.cellY - (tgt.prevCellY ?? tgt.cellY)) * tt) * CELL + CELL / 2;

      const mx = (ax + tx) / 2;
      const my = (ay + ty) / 2;
      // Angle from attacker toward target; 🗡️ naturally points up-right (~-45°), offset accordingly
      const angle = Math.atan2(ty - ay, tx - ax) + Math.PI * 1.25;

      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.translate(mx, my);
      ctx.rotate(angle);
      ctx.drawImage(ec, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }

  private _drawClouds(ctx: CanvasRenderingContext2D, world: World, _camera: Camera): void {
    const now = performance.now();
    for (const cloud of world.clouds) {
      const total = cloud.totalLifetimeMs || 7500;
      const progress = Math.min(1, (now - cloud.spawnedAtMs) / total);

      // Fade in during first 25%, full opacity in middle, fade out during last 25%
      let alpha: number;
      if (progress < 0.25) alpha = progress / 0.25;
      else if (progress < 0.75) alpha = 1;
      else alpha = (1 - progress) / 0.25;

      // Analytically compute x displacement: fast → slow (rain) → fast
      // Phase 1 (0–0.35): 40% of drift, Phase 2 (0.35–0.65): 20%, Phase 3 (0.65–1): 40%
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

      const maxAlpha = cloud.decorative ? 0.25 : 0.45;
      ctx.globalAlpha = Math.max(0, alpha) * maxAlpha;
      this._drawCloudAt(ctx, xF, cloud.y, CELL * 2);
      ctx.globalAlpha = Math.max(0, alpha) * maxAlpha * 0.6;
      this._drawCloudAt(ctx, xF - 1, cloud.y, CELL * 1.6);
      this._drawCloudAt(ctx, xF + 1, cloud.y - 1, CELL * 1.6);
      ctx.globalAlpha = 1;
    }
  }

  private _drawCloudAt(ctx: CanvasRenderingContext2D, xF: number, y: number, size: number): void {
    const { canvas: ec, w, h } = this._emojiCache.get(WORLD_EMOJIS.cloud);
    const scale = Math.min(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    const px = xF * CELL;
    const py = y * CELL;
    ctx.drawImage(ec, px + (CELL - dw) / 2, py + (CELL - dh) / 2, dw, dh);
  }

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
    const cx = lx * CELL + CELL / 2;
    const cy = ly * CELL + CELL / 2;
    const ringRadius = CELL / 2 - 2;
    const firstPos = remaining[0];
    const fdx = firstPos.x * CELL + CELL / 2 - cx;
    const fdy = firstPos.y * CELL + CELL / 2 - cy;
    const fdist = Math.sqrt(fdx * fdx + fdy * fdy);
    const startX = fdist > 0 ? cx + (fdx / fdist) * ringRadius : cx;
    const startY = fdist > 0 ? cy + (fdy / fdist) * ringRadius : cy;
    ctx.moveTo(startX, startY);
    for (const pos of remaining) {
      ctx.lineTo(pos.x * CELL + CELL / 2, pos.y * CELL + CELL / 2);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const goalPos = agent.goal ?? remaining[remaining.length - 1];
    if (goalPos) {
      ctx.globalAlpha = 0.9;
      this._drawCellEmoji(ctx, goalPos.x, goalPos.y, '\uD83D\uDCCD', CELL - 2);
      ctx.globalAlpha = 1;
    }
  }
}
