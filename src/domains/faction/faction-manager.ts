import { FACTION_COLORS } from '../../core/constants';
import { generatePronounceableString, key, rndi, log, uuid } from '../../core/utils';
import type { World } from '../world';
import type { Agent } from '../entity/agent';
import { Faction } from './faction';

// Inlined TUNE constants
const FLAG_HP: [number, number] = [20, 40];
const LOOT_BAG_DECAY_MS = 30000;

export class FactionManager {
  private static _nextColor(world: World): string {
    const used = new Set([...world.factions.values()].map((f) => f.color));
    for (let i = 0; i < FACTION_COLORS.length; i++) {
      if (!used.has(FACTION_COLORS[i])) return FACTION_COLORS[i];
    }
    return FACTION_COLORS[world.factions.size % FACTION_COLORS.length];
  }

  private static _placeFlag(world: World, fid: string, members: Agent[]): void {
    if (world.flags.has(fid)) return;
    const cells = members.map((a) => ({ x: a.cellX, y: a.cellY }));
    const cx = Math.round(cells.reduce((s, c) => s + c.x, 0) / cells.length);
    const cy = Math.round(cells.reduce((s, c) => s + c.y, 0) / cells.length);
    let spot = { x: cx, y: cy };
    if (world.grid.isBlocked(cx, cy)) spot = world.grid.randomFreeCell();
    world.flags.set(fid, {
      id: uuid(),
      factionId: fid,
      x: spot.x,
      y: spot.y,
      hp: rndi(FLAG_HP[0], FLAG_HP[1]),
      maxHp: FLAG_HP[1],
      storage: { food: 0, water: 0, wood: 0 },
    });
    world.flagCells.add(key(spot.x, spot.y));
    log(world, 'faction', `Faction ${fid} placed flag @${spot.x},${spot.y}`, null, {
      factionId: fid,
    });
  }

  static create(world: World, members: Agent[]): string {
    const fid = generatePronounceableString(6);
    const color = FactionManager._nextColor(world);
    const faction = new Faction(fid, color, undefined, world.tick);
    world.factions.set(fid, faction);
    for (const a of members) {
      if (a.factionId) {
        const old = world.factions.get(a.factionId);
        if (old) old.members.delete(a.id);
      }
      a.factionId = fid;
      faction.addMember(a.id);
    }
    FactionManager._placeFlag(world, fid, members);
    const names = members.map((m) => m.name).join(' & ');
    log(world, 'faction', `${names} founded faction ${fid}`, null, {
      factionId: fid,
    });
    return fid;
  }

  static disband(world: World, fid: string, reason = 'rule: <=1 member'): void {
    const f = world.factions.get(fid);
    if (!f) return;
    for (const id of f.members) {
      const a = world.agentsById.get(id);
      if (a) a.factionId = null;
    }
    world.factions.delete(fid);
    const flag = world.flags.get(fid);
    if (flag) {
      // Inline loot bag drop from flag storage
      const s = flag.storage;
      if (s.food + s.water + s.wood > 0) {
        const k = key(flag.x, flag.y);
        const existing = world.lootBags.get(k);
        if (existing) {
          existing.inventory.food += s.food;
          existing.inventory.water += s.water;
          existing.inventory.wood += s.wood;
          existing.decayMs = LOOT_BAG_DECAY_MS;
        } else {
          world.lootBags.set(k, {
            id: uuid(), x: flag.x, y: flag.y,
            inventory: { food: s.food, water: s.water, wood: s.wood },
            decayMs: LOOT_BAG_DECAY_MS,
          });
        }
        log(world, 'loot', `Flag ${flag.factionId} dropped stored resources`, null, {
          factionId: flag.factionId, x: flag.x, y: flag.y,
        });
      }
      world.flagCells.delete(key(flag.x, flag.y));
      world.flags.delete(fid);
      log(world, 'destroy', `Flag ${fid} destroyed`, null, { factionId: fid });
    }
    log(world, 'faction', `Faction ${fid} disbanded (${reason})`, null, {
      factionId: fid,
    });
  }

  static setFaction(
    world: World,
    agent: Agent,
    newFid: string | null,
    reason: string | null = null
  ): void {
    const oldFid = agent.factionId || null;
    if (oldFid === newFid) return;
    if (oldFid) {
      const old = world.factions.get(oldFid);
      if (old) old.members.delete(agent.id);
    }
    agent.factionId = newFid || null;
    if (newFid) {
      if (!world.factions.has(newFid)) {
        const color = FactionManager._nextColor(world);
        const faction = new Faction(newFid, color, undefined, world.tick);
        world.factions.set(newFid, faction);
        FactionManager._placeFlag(world, newFid, [agent]);
      }
      world.factions.get(newFid)!.members.add(agent.id);
    }
    if (oldFid && !newFid) {
      log(
        world,
        'faction',
        `${agent.name} left faction ${oldFid}${reason ? ` (${reason})` : ''}`,
        agent.id,
        { from: oldFid, to: null, reason }
      );
      FactionManager._destroyIfLonely(world, oldFid);
    } else if (!oldFid && newFid) {
      log(
        world,
        'faction',
        `${agent.name} joined faction ${newFid}${reason ? ` (${reason})` : ''}`,
        agent.id,
        { from: null, to: newFid, reason }
      );
    } else if (oldFid && newFid) {
      log(
        world,
        'faction',
        `${agent.name} moved ${oldFid} → ${newFid}${reason ? ` (${reason})` : ''}`,
        agent.id,
        { from: oldFid, to: newFid, reason }
      );
      FactionManager._destroyIfLonely(world, oldFid);
    }
  }

  private static _destroyIfLonely(world: World, fid: string): void {
    const f = world.factions.get(fid);
    if (!f) return;
    let aliveCount = 0;
    for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
    if (aliveCount <= 1) FactionManager.disband(world, fid, '<=1 alive');
  }

  static reconcile(world: World): void {
    const actual = new Map<string, Set<string>>();
    for (const a of world.agents) {
      if (!a.factionId) continue;
      if (!actual.has(a.factionId)) actual.set(a.factionId, new Set());
      actual.get(a.factionId)!.add(a.id);
    }
    for (const [fid, set] of actual) {
      if (!world.factions.has(fid)) {
        const color = FactionManager._nextColor(world);
        const faction = new Faction(fid, color, set, world.tick);
        world.factions.set(fid, faction);
      } else {
        const f = world.factions.get(fid)!;
        f.members.clear();
        for (const id of set) f.members.add(id);
      }
      if (!world.flags.has(fid)) {
        const members = [...set]
          .map((id) => world.agentsById.get(id))
          .filter((a): a is Agent => a !== undefined);
        if (members.length) FactionManager._placeFlag(world, fid, members);
      }
    }
    for (const [fid, f] of [...world.factions]) {
      let aliveCount = 0;
      for (const id of f.members) if (world.agentsById.has(id)) aliveCount++;
      if (aliveCount <= 1) FactionManager.disband(world, fid, 'reconcile');
    }
  }
}
