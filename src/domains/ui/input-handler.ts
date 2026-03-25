import { CELL, GRID } from '../../shared/constants';
import { key, log, uuid } from '../../shared/utils';
import type { World } from '../world';
import type { Camera } from '../rendering/camera';
import type { DomRefs } from './ui-manager';
import { UIManager } from './ui-manager';

export class InputHandler {
  static setup(canvas: HTMLCanvasElement, camera: Camera, world: World, dom: DomRefs): void {
    const { btnDrawWalls, btnEraseWalls } = dom.buttons;

    function setPaintMode(mode: 'draw' | 'erase') {
      const next = world.paintMode === mode ? 'none' as const : mode;
      world.paintMode = next;
      if (btnDrawWalls) btnDrawWalls.classList.toggle('toggled', next === 'draw');
      if (btnEraseWalls) btnEraseWalls.classList.toggle('toggled', next === 'erase');
    }
    btnDrawWalls?.addEventListener('click', () => setPaintMode('draw'));
    btnEraseWalls?.addEventListener('click', () => setPaintMode('erase'));

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let allowDrag = false;
    let painting = false;
    let lastPaintKey: string | null = null;

    function paintAtEvent(e: PointerEvent | MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      const wpos = camera.screenToWorld(sx, sy);
      const x = Math.floor(wpos.x / CELL);
      const y = Math.floor(wpos.y / CELL);
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
      const k = key(x, y);
      if (k === lastPaintKey) return;
      lastPaintKey = k;
      if (world.paintMode === 'draw') {
        if (
          !world.walls.has(k) &&
          !world.farms.has(k) &&
          !world.flagCells.has(k) &&
          !world.crops.has(k) &&
          !world.agentsByCell.has(k)
        ) {
          world.walls.set(k, { id: uuid(), x, y, hp: 12, maxHp: 12 });
          log(world, 'build', `Wall @${x},${y} (user)`, null, { x, y });
        }
      } else if (world.paintMode === 'erase') {
        if (world.walls.has(k)) {
          world.walls.delete(k);
          log(world, 'destroy', `Wall @${x},${y} removed (user)`, null, { x, y });
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
    canvas.addEventListener('pointerup', () => {
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

    // Agent selection
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const sx = (e.clientX - rect.left) * scaleX;
      const sy = (e.clientY - rect.top) * scaleY;
      const wpos = camera.screenToWorld(sx, sy);
      const x = Math.floor(wpos.x / CELL);
      const y = Math.floor(wpos.y / CELL);
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
      const id = world.agentsByCell.get(key(x, y));
      world.selectedId = id || null;
      UIManager.updateInspector(world, dom.inspector);
    });
  }
}
