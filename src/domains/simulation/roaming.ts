import { GRID } from '../../shared/constants';
import { rndi, key } from '../../shared/utils';
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

    const centerX = Math.floor(GRID / 2);
    const centerY = Math.floor(GRID / 2);
    const distToCenter = (c: { x: number; y: number }) =>
      Math.abs(c.x - centerX) + Math.abs(c.y - centerY);

    let choice = candidates[0];

    if (agent.travelPref === 'wander') {
      choice = candidates[rndi(0, candidates.length - 1)];
    } else if (agent.travelPref === 'near') {
      if (agent.factionId) {
        const flag = world.flags.get(agent.factionId);
        if (flag) {
          let bestScore = Infinity;
          for (const c of candidates) {
            const d = Math.abs(c.x - flag.x) + Math.abs(c.y - flag.y);
            const desired = 4;
            let crowd = 0;
            for (let dx = -2; dx <= 2; dx++) {
              for (let dy = -2; dy <= 2; dy++) {
                if (Math.abs(dx) + Math.abs(dy) > 2) continue;
                const id = world.agentsByCell.get(key(c.x + dx, c.y + dy));
                if (!id) continue;
                const b = world.agentsById.get(id);
                if (b && b.factionId === agent.factionId) crowd++;
              }
            }
            const score = Math.abs(d - desired) + crowd * 0.7;
            if (score < bestScore) {
              bestScore = score;
              choice = c;
            }
          }
        } else {
          choice = candidates.reduce((best, c) =>
            distToCenter(c) < distToCenter(best) ? c : best
          );
        }
      } else {
        choice = candidates.reduce((best, c) =>
          distToCenter(c) < distToCenter(best) ? c : best
        );
      }
    } else if (agent.travelPref === 'far') {
      if (agent.factionId) {
        const flag = world.flags.get(agent.factionId);
        if (flag) {
          choice = candidates.reduce((best, c) =>
            Math.abs(c.x - flag.x) + Math.abs(c.y - flag.y) >
            Math.abs(best.x - flag.x) + Math.abs(best.y - flag.y)
              ? c
              : best
          );
        } else {
          choice = candidates.reduce((best, c) =>
            distToCenter(c) > distToCenter(best) ? c : best
          );
        }
      } else {
        choice = candidates.reduce((best, c) =>
          distToCenter(c) > distToCenter(best) ? c : best
        );
      }
    }

    Pathfinder.planPathTo(world, agent, choice.x, choice.y);
  }
}
