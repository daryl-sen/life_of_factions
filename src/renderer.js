import { CELL, GRID, COLORS, TUNE } from './constants.js';

function drawAgentCircle(ctx, x, y, radius, stroke) {
  ctx.beginPath();
  ctx.arc(x + CELL / 2, y + CELL / 2, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawFactionPennant(ctx, cx, topY, color) {
  ctx.save();
  ctx.fillStyle = "#c7c7d2";
  ctx.fillRect(cx - 1, topY - 6, 2, 7);
  ctx.fillStyle = color || "#cccccc";
  ctx.beginPath();
  ctx.moveTo(cx + 1, topY - 5);
  ctx.lineTo(cx + 8, topY - 2);
  ctx.lineTo(cx + 1, topY + 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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

function drawActionIndicator(ctx, cx, topY, type, factionColor = "#ccc") {
  ctx.save();
  ctx.fillStyle = "#c7c7d2";
  ctx.fillRect(cx - 1, topY - 6, 2, 7);
  let fill = "#cccccc",
    stroke = "#333333";
  switch (type) {
    case "attack":
      fill = "#ff6d7a";
      break;
    case "heal":
      fill = "#60e6a8";
      break;
    case "help":
      fill = "#7bdcff";
      break;
    case "talk":
      fill = "#a5b4fc";
      break;
    case "quarrel":
      fill = "#ffb74d";
      break;
    case "reproduce":
      fill = "#f472b6";
      break;
    case "attack_flag":
      fill = factionColor || "#cccccc";
      break;
  }
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  const x = cx + 2,
    y = topY - 5;
  switch (type) {
    case "attack":
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8, y + 8);
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x, y + 8);
      ctx.strokeStyle = fill;
      ctx.stroke();
      break;
    case "heal":
      ctx.beginPath();
      ctx.fillRect(x + 3, y, 2, 8);
      ctx.fillRect(x, y + 3, 8, 2);
      break;
    case "help":
      ctx.beginPath();
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x + 4, y + 8);
      ctx.moveTo(x + 1, y + 3);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x + 7, y + 3);
      ctx.strokeStyle = fill;
      ctx.stroke();
      break;
    case "talk":
      ctx.beginPath();
      ctx.rect(x, y, 8, 6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 6);
      ctx.lineTo(x + 4, y + 8);
      ctx.lineTo(x + 4, y + 6);
      ctx.closePath();
      ctx.fill();
      break;
    case "quarrel":
      ctx.beginPath();
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x + 6, y + 3);
      ctx.lineTo(x + 4, y + 3);
      ctx.lineTo(x + 7, y + 8);
      ctx.lineTo(x + 1, y + 4);
      ctx.lineTo(x + 3, y + 4);
      ctx.closePath();
      ctx.fill();
      break;
    case "reproduce":
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 7);
      ctx.bezierCurveTo(x + 8, y + 4, x + 7, y + 0.5, x + 5, y + 1.2);
      ctx.bezierCurveTo(x + 4, y + 1.8, x + 4, y + 3, x + 4, y + 3);
      ctx.bezierCurveTo(x + 4, y + 3, x + 4, y + 1.8, x + 3, y + 1.2);
      ctx.bezierCurveTo(x + 1, y + 0.5, x + 0, y + 4, x + 4, y + 7);
      ctx.fill();
      break;
    case "attack_flag":
      drawFactionPennant(ctx, cx, topY, factionColor);
      break;
    default:
      ctx.fillRect(x, y, 8, 8);
  }
  ctx.restore();
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

  ctx.fillStyle = COLORS.crop;
  for (const c of world.crops.values())
    drawTriangle(ctx, c.x * CELL, c.y * CELL);

  for (const f of world.farms.values()) {
    ctx.fillStyle = COLORS.farm;
    ctx.fillRect(f.x * CELL + 2, f.y * CELL + 2, CELL - 4, CELL - 4);
  }

  for (const w of world.walls.values()) {
    const dmg = 1 - w.hp / w.maxHp;
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(w.x * CELL + 1, w.y * CELL + 1, CELL - 2, CELL - 2);
    if (dmg > 0) {
      ctx.fillStyle = COLORS.wallDam;
      ctx.globalAlpha = Math.min(0.7, Math.max(0, dmg));
      ctx.fillRect(w.x * CELL + 1, w.y * CELL + 1, CELL - 2, CELL - 2);
      ctx.globalAlpha = 1;
    }
  }

  for (const f of world.flags.values()) {
    const faction = world.factions.get(f.factionId);
    const col = faction?.color || "#cccccc";
    ctx.fillStyle = COLORS.flagPole;
    ctx.fillRect(f.x * CELL + 6, f.y * CELL + 2, 3, CELL - 4);
    ctx.fillStyle = col;
    ctx.fillRect(f.x * CELL + 9, f.y * CELL + 4, CELL - 8, 8);
  }

  const pendingAttackLines = [];

  for (const a of world.agents) {
    const x = a.cellX * CELL,
      y = a.cellY * CELL;
    ctx.fillStyle = COLORS.agentFill;
    const col = a.factionId
      ? world.factions.get(a.factionId)?.color || "#fff"
      : "#6b7280";
    drawAgentCircle(ctx, x, y, CELL / 2 - 3, col);
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
      const fcol = a.factionId
        ? world.factions.get(a.factionId)?.color || "#cccccc"
        : "#cccccc";
      if (a.action.type === "attack" && a.action.payload?.targetId) {
        const t = world.agentsById.get(a.action.payload.targetId);
        if (t) pendingAttackLines.push([a, t]);
      }
      drawActionIndicator(ctx, cx, glyphTop, a.action.type, fcol);
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
