// render.js
import { CELL, GRID, OFFSET, COLORS, FACTION_COLORS } from "./constants.js";
import { key } from "./utils.js";

function drawAgentCircle(ctx, x, y, radius, stroke) {
  ctx.beginPath();
  ctx.arc(x + CELL / 2, y + CELL / 2, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();
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

export function render(world, ctx, canvas, hud, stats, factionsList) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(OFFSET, OFFSET);

  // grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= GRID; i++) {
    ctx.moveTo(0, i * CELL + 0.5);
    ctx.lineTo(GRID * CELL, i * CELL + 0.5);
  }
  for (let i = 0; i <= GRID; i++) {
    ctx.moveTo(i * CELL + 0.5, 0);
    ctx.lineTo(i * CELL + 0.5, GRID * CELL);
  }
  ctx.stroke();

  // crops
  ctx.fillStyle = COLORS.crop;
  for (const c of world.crops.values()) {
    drawTriangle(ctx, c.x * CELL, c.y * CELL);
  }

  // farms
  for (const f of world.farms.values()) {
    ctx.fillStyle = COLORS.farm;
    ctx.fillRect(f.x * CELL + 2, f.y * CELL + 2, CELL - 4, CELL - 4);
  }

  // walls
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

  // flags
  for (const f of world.flags.values()) {
    const faction = world.factions.get(f.factionId);
    const col = faction?.color || "#cccccc";
    ctx.fillStyle = COLORS.flagPole;
    ctx.fillRect(f.x * CELL + 6, f.y * CELL + 2, 3, CELL - 4);
    ctx.fillStyle = col;
    ctx.fillRect(f.x * CELL + 9, f.y * CELL + 4, CELL - 8, 8);
  }

  // agents
  for (const a of world.agents) {
    const x = a.cellX * CELL,
      y = a.cellY * CELL;
    ctx.fillStyle = COLORS.agentFill;
    const col = a.factionId
      ? world.factions.get(a.factionId)?.color || "#fff"
      : "#6b7280";
    drawAgentCircle(ctx, x, y, CELL / 2 - 3, col);
    // hp bar
    const hpw = Math.max(0, Math.floor((CELL - 6) * (a.health / a.maxHealth)));
    ctx.fillStyle = COLORS.hp;
    ctx.fillRect(x + 3, y + 1, hpw, 2);
    if (a.energy < 40) {
      ctx.fillStyle = COLORS.energy;
      ctx.fillRect(x + CELL / 2 - 3, y - 5, 6, 3);
    }
  }

  ctx.restore();

  hud.textContent = `tick:${world.tick} | fps:${stats.fps.toFixed(
    0
  )} | agents:${world.agents.length}`;

  // sidebar stats
  stats.stAgents.textContent = world.agents.length;
  stats.stFactions.textContent = world.factions.size;
  stats.stCrops.textContent = world.crops.size;
  stats.stFarms.textContent = world.farms.size;
  stats.stWalls.textContent = world.walls.size;
  stats.stFlags.textContent = world.flags.size;

  factionsList.innerHTML = "";
  for (const [fid, f] of world.factions) {
    const color =
      f.color ||
      FACTION_COLORS[
        [...world.factions.keys()].indexOf(fid) % FACTION_COLORS.length
      ];
    const div = document.createElement("div");
    const members = [...f.members]
      .map((id) => world.agentsById.get(id))
      .filter(Boolean);
    const avgLvl = (
      members.reduce((s, a) => s + a.level, 0) / (members.length || 1)
    ).toFixed(1);
    const flag = world.flags.get(fid);
    div.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin:6px 0">
      <div style="width:12px;height:12px;border-radius:3px;background:${color}"></div>
      <div class="mono" style="flex:1">${fid}</div>
    </div>
    <div class="kv">
      <div class="muted">Members</div><div>${members.length}</div>
      <div class="muted">Avg level</div><div>${avgLvl}</div>
      <div class="muted">Flag</div><div>${
        flag ? `${flag.x},${flag.y} (${flag.hp}/${flag.maxHp})` : "—"
      }</div>
    </div>`;
    factionsList.appendChild(div);
  }
}
