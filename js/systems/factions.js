// systems/factions.js
import { FACTION_COLORS, TUNE } from "../constants.js";
import { rndi, key } from "../utils.js";
import { isBlocked } from "./spatial.js";
import { log } from "./harvest.js";

export function recomputeFactions(world) {
  const ids = world.agents.map((a) => a.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const parent = ids.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[b] = a;
  };

  for (const a of world.agents) {
    for (const [bid, val] of a.relationships) {
      if (val >= TUNE.factionThreshold && world.agentsById.has(bid))
        union(idx.get(a.id), idx.get(bid));
    }
  }

  const groups = new Map();
  ids.forEach((id, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(id);
  });

  const newFactions = new Map();
  let colorIdx = 0;
  for (const [, members] of groups) {
    if (members.length >= TUNE.factionMinSize) {
      const fid =
        members.slice().sort().join("|").slice(0, 8) + "-" + members.length;
      const color = FACTION_COLORS[colorIdx++ % FACTION_COLORS.length];
      newFactions.set(fid, { id: fid, members: new Set(members), color });
    }
  }

  const prevFlags = new Set(world.flags.keys());

  // membership changes
  for (const a of world.agents) {
    let newFid = null;
    for (const [fid, f] of newFactions) {
      if (f.members.has(a.id)) {
        newFid = fid;
        break;
      }
    }
    if (a.factionId !== newFid) {
      const old = a.factionId;
      a.factionId = newFid;
      log(
        world,
        "faction",
        `${a.name} now ${newFid ? "in faction " + newFid : "factionless"}`,
        a.id,
        { from: old, to: newFid }
      );
    }
  }

  // ensure/position flags
  const nextFlags = new Map();
  for (const [fid, f] of newFactions) {
    if (world.flags.has(fid)) {
      nextFlags.set(fid, world.flags.get(fid));
      continue;
    }
    const cells = [...f.members]
      .map((id) => world.agentsById.get(id))
      .map((a) => ({ x: a.cellX, y: a.cellY }));
    const cx = Math.round(cells.reduce((s, c) => s + c.x, 0) / cells.length);
    const cy = Math.round(cells.reduce((s, c) => s + c.y, 0) / cells.length);
    let spot = { x: cx, y: cy };
    if (isBlocked(world, cx, cy)) spot = randomFreeCell(world);
    nextFlags.set(fid, {
      id: crypto.randomUUID(),
      factionId: fid,
      x: spot.x,
      y: spot.y,
      hp: rndi(TUNE.flagHp[0], TUNE.flagHp[1]),
      maxHp: TUNE.flagHp[1],
    });
    log(
      world,
      "faction",
      `Faction ${fid} formed flag @${spot.x},${spot.y}`,
      null,
      { factionId: fid }
    );
  }
  world.flags = nextFlags;

  for (const fid of prevFlags) {
    if (!world.flags.has(fid))
      log(world, "destroy", `Flag ${fid} removed`, null, { factionId: fid });
  }

  world.factions = new Map();
  for (const [fid, f] of newFactions) {
    world.factions.set(fid, { id: fid, members: f.members, color: f.color });
  }
}

export function randomFreeCell(world) {
  for (let tries = 0; tries < 5000; tries++) {
    const x = Math.floor(Math.random() * 62);
    const y = Math.floor(Math.random() * 62);
    if (!isBlocked(world, x, y)) return { x, y };
  }
  return { x: 0, y: 0 };
}
