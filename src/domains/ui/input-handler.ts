import { CELL_PX, GRID_SIZE, OBSTACLE_EMOJIS, OBSTACLE_CATEGORY } from '../../core/constants';
import { key, log, uuid } from '../../core/utils';
import type { World } from '../world';
import type { Camera } from '../rendering/camera';
import type { DomRefs } from './ui-manager';
import { UIManager } from './ui-manager';

export class InputHandler {
  static setup(canvas: HTMLCanvasElement, camera: Camera, world: World, dom: DomRefs): void {
    const { btnDrawObstacles, btnEraseObstacles, btnPaintSaltWater, btnPaintLand } = dom.buttons;

    const allPaintBtns = [btnDrawObstacles, btnEraseObstacles, btnPaintSaltWater, btnPaintLand, dom.buttons.btnReplenish];

    function setPaintMode(mode: 'draw' | 'erase' | 'paintSaltWater' | 'paintLand') {
      const next = world.paintMode === mode ? 'none' as const : mode;
      world.paintMode = next;
      // Clear all toggle states then set the active one
      if (btnDrawObstacles) btnDrawObstacles.classList.toggle('toggled', next === 'draw');
      if (btnEraseObstacles) btnEraseObstacles.classList.toggle('toggled', next === 'erase');
      if (btnPaintSaltWater) btnPaintSaltWater.classList.toggle('toggled', next === 'paintSaltWater');
      if (btnPaintLand) btnPaintLand.classList.toggle('toggled', next === 'paintLand');
      const btnReplenish = dom.buttons.btnReplenish;
      if (btnReplenish) btnReplenish.classList.remove('toggled');
    }
    btnDrawObstacles?.addEventListener('click', () => setPaintMode('draw'));
    btnEraseObstacles?.addEventListener('click', () => setPaintMode('erase'));
    btnPaintSaltWater?.addEventListener('click', () => setPaintMode('paintSaltWater'));
    btnPaintLand?.addEventListener('click', () => setPaintMode('paintLand'));

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let allowDrag = false;
    let painting = false;
    let lastPaintKey: string | null = null;

    // Touch-specific state for single-finger pan
    let activeTouchCount = 0;
    let isTouchDrag = false;
    let touchStartX = 0;
    let touchStartY = 0;
    const TOUCH_DRAG_THRESHOLD = 8;

    function paintAtEvent(e: PointerEvent | MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      const wpos = camera.screenToWorld(sx, sy);
      const x = Math.floor(wpos.x / CELL_PX);
      const y = Math.floor(wpos.y / CELL_PX);
      if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return;
      const k = key(x, y);
      if (k === lastPaintKey) return;
      lastPaintKey = k;
      if (world.paintMode === 'draw') {
        if (
          !world.obstacles.has(k) &&
          !world.farms.has(k) &&
          !world.flagCells.has(k) &&
          !world.foodBlocks.has(k) &&
          !world.waterBlocks.has(k) &&
          !world.treeBlocks.has(k) &&
          !world.seedlings.has(k) &&
          !world.agentsByCell.has(k)
        ) {
          const emoji = OBSTACLE_EMOJIS[Math.floor(Math.random() * OBSTACLE_EMOJIS.length)];
          const category = OBSTACLE_CATEGORY[emoji] ?? 'rock';
          world.obstacles.set(k, { id: uuid(), x, y, emoji, category, hp: 12, maxHp: 12 });
          log(world, 'build', `Obstacle @${x},${y} (user)`, null, { x, y });
        }
      } else if (world.paintMode === 'erase') {
        if (world.obstacles.has(k)) {
          world.obstacles.delete(k);
          log(world, 'destroy', `Obstacle @${x},${y} removed (user)`, null, { x, y });
        }
      } else if (world.paintMode === 'paintSaltWater') {
        if (!world.saltWaterBlocks.has(k) && !world.waterBlocks.has(k) && !world.agentsByCell.has(k)) {
          // Remove anything else occupying this cell
          world.obstacles.delete(k);
          world.foodBlocks.delete(k);
          world.treeBlocks.delete(k);
          world.seedlings.delete(k);
          world.farms.delete(k);
          world.poopBlocks.delete(k);
          world.lootBags.delete(k);
          world.saltWaterBlocks.set(k, { id: uuid(), x, y });
        }
      } else if (world.paintMode === 'paintLand') {
        if (world.saltWaterBlocks.has(k)) {
          world.saltWaterBlocks.delete(k);
        }
      }
    }

    function setAllowDrag(e: PointerEvent | MouseEvent) {
      allowDrag =
        e.buttons === 2 ||
        (e.buttons === 1 && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey));
    }

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);

      if (e.pointerType === 'touch') {
        activeTouchCount++;
        // Single-finger touch: prepare for pan (with drag threshold for tap detection)
        if (activeTouchCount === 1 && world.paintMode === 'none') {
          dragging = true;
          isTouchDrag = false;
          touchStartX = e.clientX;
          touchStartY = e.clientY;
          lastX = e.clientX;
          lastY = e.clientY;
          return;
        }
      }

      setAllowDrag(e);
      if (allowDrag) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      } else if (e.button === 0 && !allowDrag && world.paintMode !== 'none') {
        painting = true;
        lastPaintKey = null;
        paintAtEvent(e);
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointermove', (e) => {
      // Multi-touch: let the touch events handle zoom+pan
      if (e.pointerType === 'touch' && activeTouchCount >= 2) {
        dragging = false;
        return;
      }

      // Single-finger touch pan
      if (e.pointerType === 'touch' && dragging && world.paintMode === 'none') {
        if (!isTouchDrag) {
          const totalDx = e.clientX - touchStartX;
          const totalDy = e.clientY - touchStartY;
          if (Math.hypot(totalDx, totalDy) > TOUCH_DRAG_THRESHOLD) {
            isTouchDrag = true;
          }
        }
        if (isTouchDrag) {
          camera.panBy(-(e.clientX - lastX), -(e.clientY - lastY));
        }
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }

      setAllowDrag(e);
      if (dragging && allowDrag) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        camera.panBy(-dx, -dy);
        lastX = e.clientX;
        lastY = e.clientY;
      } else if (painting && (e.buttons & 1) && world.paintMode !== 'none') {
        paintAtEvent(e);
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') {
        activeTouchCount = Math.max(0, activeTouchCount - 1);
      }
      dragging = false;
      painting = false;
      lastPaintKey = null;
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
        let dx = e.deltaX;
        let dy = e.deltaY;
        if (e.deltaMode === 1) { dx *= 16; dy *= 16; }
        if (e.deltaMode === 2) { dx *= 100; dy *= 100; }
        if (e.ctrlKey || e.metaKey) {
          const factor = Math.pow(2, -dy * 0.01);
          camera.zoomAt(sx, sy, factor);
        } else {
          camera.panBy(dx, dy);
        }
      },
      { passive: false }
    );

    // Touch events
    let lastTouchDist = 0;
    let lastTouchCenter: { x: number; y: number } | null = null;

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = [e.touches[0], e.touches[1]];
        lastTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        lastTouchCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const center = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        if (lastTouchDist > 0) {
          const factor = dist / lastTouchDist;
          const rect = canvas.getBoundingClientRect();
          const zx = (center.x - rect.left) * (canvas.width / rect.width);
          const zy = (center.y - rect.top) * (canvas.height / rect.height);
          camera.zoomAt(zx, zy, factor);
        }
        if (lastTouchCenter) {
          camera.panBy(-(center.x - lastTouchCenter.x), -(center.y - lastTouchCenter.y));
        }
        lastTouchDist = dist;
        lastTouchCenter = center;
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        lastTouchDist = 0;
        lastTouchCenter = null;
      }
    });

    // Agent selection & replenish tool
    canvas.addEventListener('click', (e) => {
      // Suppress click after a touch drag (tap = select, drag = pan)
      if (isTouchDrag) { isTouchDrag = false; return; }
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const sx = (e.clientX - rect.left) * scaleX;
      const sy = (e.clientY - rect.top) * scaleY;
      const wpos = camera.screenToWorld(sx, sy);
      const x = Math.floor(wpos.x / CELL_PX);
      const y = Math.floor(wpos.y / CELL_PX);
      if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return;
      const id = world.agentsByCell.get(key(x, y));

      if (world.paintMode === 'replenish' && id) {
        const agent = world.agentsById.get(id);
        if (agent) {
          agent.health = agent.maxHealth;
          agent.energy = agent.maxEnergy;
          agent.fullness = 100;
          agent.hygiene = 100;
          agent.social = 100;
          agent.inspiration = 100;
          agent.diseased = false;
        }
        return;
      }

      world.selectedId = id || null;
      world.activeLogAgentId = id || null;
      // Sync the agent filter dropdown
      const agentSelect = document.getElementById('agentFilterSelect') as HTMLSelectElement | null;
      if (agentSelect) agentSelect.value = id || '';
      UIManager.updateInspector(world, dom.inspector);
    });
  }
}
