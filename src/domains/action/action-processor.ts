import { GRID, TUNE } from '../../shared/constants';
import type { IInventory } from '../../shared/types';
import { manhattan, log, key, uuid, rndi } from '../../shared/utils';
import type { World } from '../world';
import type { Agent } from '../agent';
import { FactionManager } from '../faction';
import { AgentFactory } from '../agent';
import { InteractionEngine } from './interaction-engine';
import { SimulationEngine } from '../simulation/simulation-engine';
import { LootBagManager } from '../world/loot-bag-manager';
import { PoopBlockManager } from '../world/poop-block-manager';

export class ActionProcessor {
  static process(world: World, agent: Agent, dtMs: number): void {
    if (!agent.action) return;
    const act = agent.action;

    // Sleep is interruptible by attack
    if (act.type === 'sleep' && agent._underAttack) {
      agent.action = null;
      return;
    }

    // Don't cancel sleep, attack, harvest, eat, drink, or short utility actions on low energy
    if (agent.energy < TUNE.energyLowThreshold &&
      act.type !== 'attack' && act.type !== 'sleep' &&
      act.type !== 'harvest' && act.type !== 'eat' && act.type !== 'drink' &&
      act.type !== 'deposit' && act.type !== 'withdraw' && act.type !== 'pickup' &&
      act.type !== 'poop' && act.type !== 'clean' &&
      act.type !== 'play' && act.type !== 'build_farm'
    ) {
      agent.action = null;
      return;
    }

    act.remainingMs -= dtMs;
    act.tickCounterMs += dtMs;
    const costPerMs = (TUNE.actionCost[act.type] || 0) / 1000;
    agent.energy -= costPerMs * dtMs;

    // Fullness decays during all actions
    agent.drainFullness((TUNE.fullness.actionDecayPerSec / 1000) * dtMs);

    const targ = act.payload?.targetId
      ? world.agentsById.get(act.payload.targetId)      : undefined;

    if (targ) {
      const dist = manhattan(agent.cellX, agent.cellY, targ.cellX, targ.cellY);
      if (act.type === 'attack') {
        if (dist > 2) { agent.action = null; return; }
      } else {
        if (dist !== 1) { agent.action = null; return; }
      }
    }

    // Harvest proximity: must stay adjacent to target position
    if (act.type === 'harvest' && act.payload?.targetPos) {
      const tp = act.payload.targetPos;
      const dist = manhattan(agent.cellX, agent.cellY, tp.x, tp.y);
      if (dist > 1) { agent.action = null; return; }
    }

    // Deposit/withdraw proximity: must stay adjacent to own faction flag
    if ((act.type === 'deposit' || act.type === 'withdraw') && agent.factionId) {
      const flag = world.flags.get(agent.factionId);
      if (!flag || manhattan(agent.cellX, agent.cellY, flag.x, flag.y) > 1) {
        agent.action = null; return;
      }
    }

    // Play proximity: must be adjacent to target
    if (act.type === 'play' && act.payload?.targetPos) {
      const tp = act.payload.targetPos;
      if (manhattan(agent.cellX, agent.cellY, tp.x, tp.y) > 1) {
        agent.action = null; return;
      }
    }

    // Clean proximity: must be adjacent to poop block
    if (act.type === 'clean' && act.payload?.targetPos) {
      const tp = act.payload.targetPos;
      if (manhattan(agent.cellX, agent.cellY, tp.x, tp.y) > 1) {
        agent.action = null; return;
      }
    }

    // Pickup proximity: must be on or adjacent to loot bag
    if (act.type === 'pickup' && act.payload?.targetPos) {
      const tp = act.payload.targetPos;
      if (manhattan(agent.cellX, agent.cellY, tp.x, tp.y) > 1) {
        agent.action = null; return;
      }
    }

    if (act.tickCounterMs >= 500) {
      act.tickCounterMs = 0;
      ActionProcessor._applyPeriodicEffect(world, agent, targ);
    }

    if (act.remainingMs <= 0) {
      ActionProcessor._applyCompletion(world, agent, targ);
      agent.action = null;
    }
  }

  private static _checkLevelUp(world: World, agent: Agent): void {
    while (agent.canLevelUp()) {
      agent.levelUp();
      log(world, 'level', `${agent.name} leveled to ${agent.level}`, agent.id, {});
    }
  }

  private static _applyPeriodicEffect(
    world: World,
    agent: Agent,
    targ: Agent | undefined
  ): void {
    const act = agent.action!;

    if (act.type === 'sleep') {
      agent.addEnergy(TUNE.sleep.energyPerTick);
    } else if (act.type === 'attack' && targ) {
      targ.takeDamage(agent.attack * 0.4);
      if (agent.factionId === targ.factionId) {
        Math.random() < 0.3
          ? (targ.factionId = null)
          : InteractionEngine.chooseAttack(world, targ, false);
      }
      agent.relationships.set(targ.id, agent.relationships.get(targ.id) - 0.2);
      log(world, 'attack', `${agent.name} hit ${targ.name}`, agent.id, { to: targ.id });
      if (targ.health <= 0) {
        agent.addXp(TUNE.xp.perKill);
        ActionProcessor._checkLevelUp(world, agent);
      }
    } else if (act.type === 'heal' && targ) {
      targ.healBy(2);
      log(world, 'heal', `${agent.name} healed ${targ.name}`, agent.id, { to: targ.id });
    } else if (act.type === 'share' && targ) {
      // Transfer 1 resource unit per tick from sharer to target
      const rt = ActionProcessor._pickShareResource(agent, targ);
      if (rt && agent.inventory[rt] > 0 && !targ.inventoryFull()) {
        agent.removeFromInventory(rt, 1);
        targ.addToInventory(rt, 1);
        log(world, 'share', `${agent.name} gave 1 ${rt} to ${targ.name}`, agent.id, { to: targ.id, resource: rt });
      }
    } else if (act.type === 'quarrel' && targ) {
      const delta =
        (Math.random() < 0.5 ? -0.1 : 0.1) *
        (agent.factionId === targ.factionId ? 0.6 : 1);
      agent.relationships.set(targ.id, agent.relationships.get(targ.id) + delta);
      targ.relationships.set(agent.id, targ.relationships.get(agent.id) + delta);
      log(world, 'quarrel', `${agent.name} ${delta > 0 ? 'made peace with' : 'argued with'} ${targ.name}`, agent.id, { to: targ.id, delta });
    } else if (act.type === 'talk' && targ) {
      const delta =
        (Math.random() < 0.75 ? 0.14 : -0.06) *
        (agent.factionId === targ.factionId ? 1.1 : 0.8);
      agent.relationships.set(targ.id, agent.relationships.get(targ.id) + delta);
      targ.relationships.set(agent.id, targ.relationships.get(agent.id) + delta);
      log(world, 'talk', `${agent.name} talked with ${targ.name}`, agent.id, { to: targ.id, delta });
    }
  }

  private static _applyCompletion(
    world: World,
    agent: Agent,
    targ: Agent | undefined
  ): void {
    const act = agent.action!;

    // Social hygiene decay on completion
    if ((act.type === 'talk' || act.type === 'quarrel' || act.type === 'share' || act.type === 'heal') && targ) {
      agent.hygiene = Math.max(0, agent.hygiene - TUNE.hygiene.socialDecay);
      targ.hygiene = Math.max(0, targ.hygiene - TUNE.hygiene.socialDecay);
    }

    // XP on action completion
    if (act.type === 'heal' && targ) {
      agent.addXp(TUNE.xp.perHeal);
      if (targ.diseased) {
        targ.diseased = false;
        log(world, 'hygiene', `${agent.name} cured ${targ.name}'s disease`, agent.id, { to: targ.id });
      }
      ActionProcessor._checkLevelUp(world, agent);
    } else if (act.type === 'share' && targ) {
      agent.addXp(TUNE.xp.perShare);
      agent.social = Math.min(100, agent.social + TUNE.share.sharerSocial);
      targ.social = Math.min(100, targ.social + TUNE.share.recipientSocial);
      agent.relationships.set(targ.id, agent.relationships.get(targ.id) + TUNE.share.relationshipGain);
      targ.relationships.set(agent.id, targ.relationships.get(agent.id) + TUNE.share.relationshipGain);
      ActionProcessor._checkLevelUp(world, agent);
    } else if (act.type === 'sleep') {
      log(world, 'sleep', `${agent.name} woke up`, agent.id, {});
    } else if (act.type === 'harvest') {
      ActionProcessor._completeHarvest(world, agent);
    } else if (act.type === 'eat') {
      ActionProcessor._completeEat(world, agent);
    } else if (act.type === 'drink') {
      ActionProcessor._completeDrink(world, agent);
    } else if (act.type === 'deposit') {
      ActionProcessor._completeDeposit(world, agent);
    } else if (act.type === 'withdraw') {
      ActionProcessor._completeWithdraw(world, agent);
    } else if (act.type === 'pickup') {
      ActionProcessor._completePickup(world, agent);
    } else if (act.type === 'poop') {
      ActionProcessor._completePoop(world, agent);
    } else if (act.type === 'clean') {
      ActionProcessor._completeClean(world, agent);
    } else if (act.type === 'play') {
      ActionProcessor._completePlay(world, agent);
    } else if (act.type === 'build_farm') {
      ActionProcessor._completeBuildFarm(world, agent);
    }

    if (targ && !agent.factionId && !targ.factionId) {
      const rel = agent.relationships.get(targ.id);
      if (
        (act.type === 'talk' || act.type === 'share' || act.type === 'heal') &&
        rel >= TUNE.factionFormRelThreshold
      ) {
        FactionManager.create(world, [agent, targ]);
      }
    }

    if (act.type === 'share' && targ && agent.factionId) {
      if (
        Math.random() < TUNE.shareConvertChance &&
        agent.relationships.get(targ.id) >= TUNE.shareConvertRelThreshold &&
        targ.factionId !== agent.factionId
      ) {
        FactionManager.setFaction(world, targ, agent.factionId, 'recruitment');
      }
    }

    if (act.type === 'reproduce' && targ && targ.health > 0) {
      if (manhattan(agent.cellX, agent.cellY, targ.cellX, targ.cellY) === 1) {
        const spots: [number, number][] = [
          [agent.cellX + 1, agent.cellY],
          [agent.cellX - 1, agent.cellY],
          [agent.cellX, agent.cellY + 1],
          [agent.cellX, agent.cellY - 1],
        ];
        const free = spots.find(([x, y]) => !world.grid.isBlocked(x, y));
        if (free) {
          agent.drainEnergy(12);
          targ.drainEnergy(12);
          // Transfer fullness from parents to child
          const p1Range = TUNE.baby.fullnessPerParent;
          const p2Range = TUNE.baby.fullnessPerParent;
          const p1Donate = Math.min(agent.fullness, p1Range[0] + Math.random() * (p1Range[1] - p1Range[0]));
          const p2Donate = Math.min(targ.fullness, p2Range[0] + Math.random() * (p2Range[1] - p2Range[0]));
          agent.drainFullness(p1Donate);
          targ.drainFullness(p2Donate);
          const childFullness = Math.min(TUNE.fullness.max, p1Donate + p2Donate);
          const babyMs = TUNE.baby.durationRange[0] + Math.random() * (TUNE.baby.durationRange[1] - TUNE.baby.durationRange[0]);
          const [x, y] = free;
          const child = AgentFactory.createChild(world, agent, targ, x, y, childFullness, babyMs);
          const pa = agent.factionId || null;
          const pb = targ.factionId || null;
          let chosen: string | null = null;
          if (pa && pb) chosen = Math.random() < 0.5 ? pa : pb;
          else chosen = pa || pb;
          if (chosen) FactionManager.setFaction(world, child, chosen, 'birth');
          world.totalBirths++;
          world.birthTimestamps.push(performance.now());
          log(world, 'reproduce', `${agent.name} & ${targ.name} had ${child.name}`, agent.id, { child: child.id });
        }
      }
    }
  }

  private static _completeHarvest(world: World, agent: Agent): void {
    const act = agent.action!;
    const tp = act.payload?.targetPos;
    if (!tp) return;
    if (agent.inventoryFull()) return;

    const rt = act.payload?.resourceType || 'food_lq';

    if (rt === 'food_hq' || rt === 'food_lq') {
      ActionProcessor._harvestFood(world, agent, tp);
    } else if (rt === 'water') {
      ActionProcessor._harvestWater(world, agent, tp);
    } else if (rt === 'wood') {
      ActionProcessor._harvestWood(world, agent, tp);
    }
  }

  private static _harvestFood(world: World, agent: Agent, tp: { x: number; y: number }): void {
    const k = key(tp.x, tp.y);
    const block = world.foodBlocks.get(k);
    if (block && block.units > 0) {
      block.units--;
      agent.addToInventory('food', 1);
      agent.addXp(TUNE.xp.perHarvest);
      log(world, 'harvest', `${agent.name} harvested food`, agent.id, { x: tp.x, y: tp.y });
      if (block.units <= 0) world.foodBlocks.delete(k);
      ActionProcessor._checkLevelUp(world, agent);
      return;
    }
    // Fallback: harvest seedling as low-quality food
    const seedling = world.seedlings.get(k);
    if (seedling) {
      world.seedlings.delete(k);
      agent.addToInventory('food', 1);
      agent.addXp(TUNE.xp.perHarvest);
      log(world, 'harvest', `${agent.name} harvested seedling`, agent.id, { x: tp.x, y: tp.y });
      ActionProcessor._checkLevelUp(world, agent);
    }
  }

  private static _harvestWater(world: World, agent: Agent, tp: { x: number; y: number }): void {
    const k = key(tp.x, tp.y);
    const block = world.waterBlocks.get(k);
    if (!block || block.units <= 0) return;
    block.units--;
    agent.addToInventory('water', 1);
    agent.addXp(TUNE.xp.perHarvest);
    log(world, 'harvest', `${agent.name} harvested water`, agent.id, { x: tp.x, y: tp.y });

    if (block.units <= 0) {
      // Remove all cell keys
      for (const c of block.cells) world.waterBlocks.delete(key(c.x, c.y));
    } else if (block.size === 'large' && block.units < block.maxUnits * TUNE.water.shrinkThreshold) {
      // Shrink large → small
      const keepCell = block.cells[Math.floor(Math.random() * block.cells.length)];
      for (const c of block.cells) world.waterBlocks.delete(key(c.x, c.y));
      block.size = 'small';
      block.x = keepCell.x;
      block.y = keepCell.y;
      block.cells = [keepCell];
      world.waterBlocks.set(key(keepCell.x, keepCell.y), block);
      log(world, 'info', `Water block shrunk @${keepCell.x},${keepCell.y}`, null, {});
    }
    ActionProcessor._checkLevelUp(world, agent);
  }

  private static _harvestWood(world: World, agent: Agent, tp: { x: number; y: number }): void {
    const k = key(tp.x, tp.y);
    const tree = world.treeBlocks.get(k);
    if (!tree || tree.units <= 0) return;
    tree.units--;
    agent.addToInventory('wood', 1);
    agent.addXp(TUNE.xp.perHarvest);
    log(world, 'harvest', `${agent.name} harvested wood`, agent.id, { x: tp.x, y: tp.y });

    // Roll for seedling (10%) or food (5%) — mutually exclusive
    const roll = Math.random();
    if (roll < TUNE.tree.seedlingChanceOnHarvest) {
      SimulationEngine.trySpawnSeedling(world, tree.x, tree.y);
    } else if (roll < TUNE.tree.seedlingChanceOnHarvest + TUNE.tree.foodChanceOnHarvest) {
      // Food only spawns if poop nearby
      const hasPoop = SimulationEngine.hasPoopNearby(world, tree.x, tree.y, TUNE.tree.foodRequiresPoopRadius);
      if (hasPoop) SimulationEngine.trySpawnFoodNearTree(world, tree.x, tree.y);
    }

    if (tree.units <= 0) {
      world.treeBlocks.delete(k);
      world.deadMarkers.push({ cellX: tree.x, cellY: tree.y, cause: 'tree', msRemaining: 10000 });
    }
    ActionProcessor._checkLevelUp(world, agent);
  }

  private static _completeEat(world: World, agent: Agent): void {
    const removed = agent.removeFromInventory('food', 1);
    if (removed <= 0) return;
    agent.addFullness(TUNE.fullness.cropGain);
    agent.addXp(TUNE.xp.perEat);
    agent.poopTimerMs = TUNE.eat.poopWindowMs;
    log(world, 'eat', `${agent.name} ate food`, agent.id, {});
    ActionProcessor._checkLevelUp(world, agent);
  }

  private static _completeDrink(world: World, agent: Agent): void {
    const removed = agent.removeFromInventory('water', 1);
    if (removed <= 0) return;
    agent.hygiene = Math.min(100, agent.hygiene + TUNE.drink.hygieneGain);
    log(world, 'eat', `${agent.name} drank water`, agent.id, {});
  }

  private static _completeDeposit(world: World, agent: Agent): void {
    if (!agent.factionId) return;
    const flag = world.flags.get(agent.factionId);
    if (!flag) return;
    const act = agent.action!;
    const rt = (act.payload?.resourceType || 'food') as keyof typeof flag.storage;
    const cap = TUNE.flagStorage.capacityPerType;
    const space = cap - flag.storage[rt];
    if (space <= 0) return;
    const amount = act.payload?.amount ?? agent.inventory[rt];
    const actual = Math.min(amount, agent.inventory[rt], space);
    if (actual <= 0) return;
    agent.removeFromInventory(rt, actual);
    flag.storage[rt] += actual;
    log(world, 'share', `${agent.name} deposited ${actual} ${rt}`, agent.id, { resource: rt, amount: actual });
  }

  private static _completeWithdraw(world: World, agent: Agent): void {
    if (!agent.factionId) return;
    const flag = world.flags.get(agent.factionId);
    if (!flag) return;
    const act = agent.action!;
    const rt = (act.payload?.resourceType || 'food') as keyof typeof flag.storage;
    if (flag.storage[rt] <= 0) return;
    const amount = act.payload?.amount ?? flag.storage[rt];
    const actual = agent.addToInventory(rt, Math.min(amount, flag.storage[rt]));
    if (actual <= 0) return;
    flag.storage[rt] -= actual;
    log(world, 'share', `${agent.name} withdrew ${actual} ${rt}`, agent.id, { resource: rt, amount: actual });
  }

  private static _completePickup(world: World, agent: Agent): void {
    const act = agent.action!;
    const tp = act.payload?.targetPos;
    if (!tp) return;
    const k = key(tp.x, tp.y);
    const bag = world.lootBags.get(k);
    if (!bag) return;
    const types: (keyof typeof bag.inventory)[] = ['food', 'water', 'wood'];
    for (const rt of types) {
      if (bag.inventory[rt] <= 0) continue;
      const added = agent.addToInventory(rt, bag.inventory[rt]);
      bag.inventory[rt] -= added;
    }
    const remaining = bag.inventory.food + bag.inventory.water + bag.inventory.wood;
    if (remaining <= 0) {
      world.lootBags.delete(k);
    }
    log(world, 'loot', `${agent.name} picked up loot`, agent.id, { x: tp.x, y: tp.y });
  }

  private static _completePlay(world: World, agent: Agent): void {
    agent.inspiration = Math.min(100, agent.inspiration + TUNE.inspiration.playGain);
    // Check if any poop block within manhattan ≤ 1 of agent
    const adj: [number, number][] = [
      [agent.cellX, agent.cellY],
      [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
      [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
    ];
    let nearPoop = false;
    for (const [nx, ny] of adj) {
      if (world.poopBlocks.has(key(nx, ny))) { nearPoop = true; break; }
    }
    if (nearPoop) {
      agent.hygiene = Math.max(0, agent.hygiene - TUNE.play.hygienePoopPenalty);
    }
    log(world, 'info', `${agent.name} played${nearPoop ? ' (near poop!)' : ''}`, agent.id, {});
  }

  private static _completeBuildFarm(world: World, agent: Agent): void {
    if (agent.inventory.wood < TUNE.farm.woodCost || agent.energy < TUNE.farm.energyCost) return;
    // Find adjacent free cell for the farm
    const adj: [number, number][] = [
      [agent.cellX + 1, agent.cellY], [agent.cellX - 1, agent.cellY],
      [agent.cellX, agent.cellY + 1], [agent.cellX, agent.cellY - 1],
    ];
    const free = adj.filter(
      ([x, y]) => x >= 0 && y >= 0 && x < GRID && y < GRID &&
        !world.grid.isBlocked(x, y) && !world.farms.has(key(x, y))
    );
    if (!free.length) return;
    const [x, y] = free[rndi(0, free.length - 1)];
    agent.removeFromInventory('wood', TUNE.farm.woodCost);
    agent.drainEnergy(TUNE.farm.energyCost);
    world.farms.set(key(x, y), {
      id: uuid(), x, y,
      spawnsRemaining: TUNE.farm.maxSpawns,
      spawnTimerMs: rndi(TUNE.farm.spawnIntervalRange[0], TUNE.farm.spawnIntervalRange[1]),
    });
    agent.addXp(TUNE.xp.perBuildFarm);
    agent.inspiration = Math.min(100, agent.inspiration + TUNE.inspiration.buildGain);
    log(world, 'build', `${agent.name} built farm`, agent.id, { x, y });
    ActionProcessor._checkLevelUp(world, agent);
  }

  private static _completePoop(world: World, agent: Agent): void {
    PoopBlockManager.spawnPoop(world, agent.cellX, agent.cellY);
    agent.hygiene = Math.max(0, agent.hygiene - TUNE.hygiene.poopDecay);
    log(world, 'hygiene', `${agent.name} pooped`, agent.id, { x: agent.cellX, y: agent.cellY });
  }

  private static _completeClean(world: World, agent: Agent): void {
    const act = agent.action!;
    const tp = act.payload?.targetPos;
    if (!tp) return;
    const k = key(tp.x, tp.y);
    if (world.poopBlocks.has(k)) {
      world.poopBlocks.delete(k);
      agent.inspiration = Math.min(100, agent.inspiration + TUNE.clean.inspirationGain);
      log(world, 'hygiene', `${agent.name} cleaned poop`, agent.id, { x: tp.x, y: tp.y });
    }
  }

  private static _pickShareResource(agent: Agent, targ: Agent): keyof IInventory | null {
    if (agent.inventoryTotal() <= 0) return null;
    if (targ.fullness < 40 && agent.inventory.food > 0) return 'food';
    if (targ.hygiene < 40 && agent.inventory.water > 0) return 'water';
    // Give whatever agent has most of
    const { food, water, wood } = agent.inventory;
    if (food >= water && food >= wood && food > 0) return 'food';
    if (water >= food && water >= wood && water > 0) return 'water';
    if (wood > 0) return 'wood';
    return null;
  }
}
