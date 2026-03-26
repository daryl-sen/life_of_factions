import { rndi } from '../../shared/utils';
import { Pathfinder } from '../../shared/pathfinding';
import type { World } from '../world';
import type { Agent } from '../agent';

export class RoamingStrategy {
  static biasedRoam(world: World, agent: Agent): void {
    const range = 6;
    const candidates: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const rx = Math.max(0, Math.min(61, agent.cellX + rndi(-range, range)));
      const ry = Math.max(0, Math.min(61, agent.cellY + rndi(-range, range)));
      if (!world.grid.isBlocked(rx, ry, agent.id)) candidates.push({ x: rx, y: ry });
    }
    if (!candidates.length) return;

    const choice = candidates[rndi(0, candidates.length - 1)];
    Pathfinder.planPathTo(world, agent, choice.x, choice.y);
  }
}
