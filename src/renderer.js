import { CELL, GRID, COLORS, TUNE, AGENT_EMOJIS, WORLD_EMOJIS } from './constants.js';

const emojiCache = new Map();

function getEmojiCanvas(emoji) {
  if (emojiCache.has(emoji)) return emojiCache.get(emoji);
  // Render emoji large, then find its actual pixel bounds
  const pad = 64;
  const fontSize = 48;
  const tmp = document.createElement("canvas");
  tmp.width = pad * 2;
  tmp.height = pad * 2;
  const tc = tmp.getContext("2d");
  tc.font = `${fontSize}px serif`;
  tc.textAlign = "center";
  tc.textBaseline = "middle";
  tc.fillText(emoji, pad, pad);

  // Scan for actual pixel bounds
  const imgData = tc.getImageData(0, 0, tmp.width, tmp.height);
  const d = imgData.data;
  let top = tmp.height, bottom = 0, left = tmp.width, right = 0;
  for (let py = 0; py < tmp.height; py++) {
    for (let px = 0; px < tmp.width; px++) {
      if (d[(py * tmp.width + px) * 4 + 3] > 10) {
        if (py < top) top = py;
        if (py > bottom) bottom = py;
        if (px < left) left = px;
        if (px > right) right = px;
      }
    }
  }

  const w = right - left + 1;
  const h = bottom - top + 1;
  const trimmed = document.createElement("canvas");
  trimmed.width = w;
  trimmed.height = h;
  trimmed.getContext("2d").drawImage(tmp, left, top, w, h, 0, 0, w, h);
  const entry = { canvas: trimmed, w, h };
  emojiCache.set(emoji, entry);
  return entry;
}

const tintCache = new Map();

function getTintedEmoji(emoji, color) {
  const key = emoji + color;
  if (tintCache.has(key)) return tintCache.get(key);
  const src = getEmojiCanvas(emoji);
  const c = document.createElement("canvas");
  c.width = src.w;
  c.height = src.h;
  const cx = c.getContext("2d");
  cx.drawImage(src.canvas, 0, 0);
  cx.globalCompositeOperation = "source-in";
  cx.fillStyle = color;
  cx.fillRect(0, 0, c.width, c.height);
  const entry = { canvas: c, w: src.w, h: src.h };
  tintCache.set(key, entry);
  return entry;
}

function drawCellEmoji(ctx, cellX, cellY, emoji, size = CELL - 2) {
  const { canvas: ec, w, h } = getEmojiCanvas(emoji);
  const scale = Math.min(size / w, size / h);
  const dw = w * scale;
  const dh = h * scale;
  const x = cellX * CELL;
  const y = cellY * CELL;
  ctx.drawImage(ec, x + (CELL - dw) / 2, y + (CELL - dh) / 2, dw, dh);
}

function drawAgentEmoji(ctx, x, y, radius, stroke, emoji) {
  ctx.beginPath();
  ctx.arc(x + CELL / 2, y + CELL / 2, radius + 1, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();

  const { canvas: ec, w, h } = getEmojiCanvas(emoji);
  const drawSize = CELL - 4;
  // Scale to fit while preserving aspect ratio
  const scale = Math.min(drawSize / w, drawSize / h);
  const dw = w * scale;
  const dh = h * scale;
  ctx.drawImage(ec, x + (CELL - dw) / 2, y + (CELL - dh) / 2, dw, dh);
}

function drawStar(ctx, cx, cy) {
  const spikes = 5,
    outer = 6,
    inner = 3.2;
  let rot = (Math.PI / 2) * 3;
  let x = cx,
    y = cy;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - outer);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outer;
    y = cy + Math.sin(rot) * outer;
    ctx.lineTo(x, y);
    rot += Math.PI / spikes;
    x = cx + Math.cos(rot) * inner;
    y = cy + Math.sin(rot) * inner;
    ctx.lineTo(x, y);
    rot += Math.PI / spikes;
  }
  ctx.lineTo(cx, cy - outer);
  ctx.closePath();
  ctx.fillStyle = "#ffd166";
  ctx.strokeStyle = "#7a5f1d";
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTriangle(ctx, x, y) {
  const cx = x + CELL / 2,
    cy = y + CELL / 2;
  const r = CELL / 2 - 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx - r * 0.866, cy + r * 0.5);
  ctx.lineTo(cx + r * 0.866, cy + r * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawLowEnergyIcon(ctx, cx, topY) {
  const w = 6,
    h = 4;
  const x = Math.round(cx) - 10;
  const y = Math.round(topY) - 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.closePath();
  ctx.fillStyle = "#ff6d7a";
  ctx.fill();
  ctx.restore();
}

export function render(world, ctx, canvas, camera) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(
    camera.scale,
    0,
    0,
    camera.scale,
    -camera.x * camera.scale,
    -camera.y * camera.scale
  );

  if (world.drawGrid) {
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

  for (const c of world.crops.values())
    drawCellEmoji(ctx, c.x, c.y, WORLD_EMOJIS.crop);

  for (const f of world.farms.values())
    drawCellEmoji(ctx, f.x, f.y, WORLD_EMOJIS.farm);

  for (const w of world.walls.values()) {
    const dmg = 1 - w.hp / w.maxHp;
    const alpha = dmg > 0 ? 1 - Math.min(0.7, dmg) : 1;
    ctx.globalAlpha = alpha;
    drawCellEmoji(ctx, w.x, w.y, WORLD_EMOJIS.wall);
    ctx.globalAlpha = 1;
  }

  for (const f of world.flags.values()) {
    const faction = world.factions.get(f.factionId);
    const col = faction?.color || "#cccccc";
    const { canvas: ec, w, h } = getTintedEmoji(WORLD_EMOJIS.flag, col);
    const scale = Math.min((CELL - 2) / w, (CELL - 2) / h);
    const dw = w * scale;
    const dh = h * scale;
    const x = f.x * CELL;
    const y = f.y * CELL;
    ctx.drawImage(ec, x + (CELL - dw) / 2, y + (CELL - dh) / 2, dw, dh);
  }

  const pendingAttackLines = [];

  for (const a of world.agents) {
    const x = a.cellX * CELL,
      y = a.cellY * CELL;
    const col = a.factionId
      ? world.factions.get(a.factionId)?.color || "#fff"
      : "#6b7280";
    const actionType = a.action?.type;
    const emoji = AGENT_EMOJIS[actionType] || (a.path ? AGENT_EMOJIS.move : AGENT_EMOJIS.idle);
    drawAgentEmoji(ctx, x, y, CELL / 2 - 3, col, emoji);
    const hpw = Math.max(
      0,
      Math.floor((CELL - 6) * (a.health / a.maxHealth))
    );
    ctx.fillStyle = COLORS.hp;
    ctx.fillRect(x + 3, y + 1, hpw, 2);
    const glyphTop = y - 8;
    const cx = x + CELL / 2;
    if (a.energy < TUNE.energyLowThreshold)
      drawLowEnergyIcon(ctx, cx, glyphTop);
    if (a.action) {
      if (a.action.type === "attack" && a.action.payload?.targetId) {
        const t = world.agentsById.get(a.action.payload.targetId);
        if (t) pendingAttackLines.push([a, t]);
      }
    }
    if (world.selectedId === a.id) drawStar(ctx, x + CELL / 2, y - 16);
  }

  ctx.strokeStyle = COLORS.attackLine;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1 / camera.scale;
  for (const [att, tgt] of pendingAttackLines) {
    ctx.beginPath();
    ctx.moveTo(att.cellX * CELL + CELL / 2, att.cellY * CELL + CELL / 2);
    ctx.lineTo(tgt.cellX * CELL + CELL / 2, tgt.cellY * CELL + CELL / 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
