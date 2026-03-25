import { CELL, GRID } from './constants.js';
import { key, log, uuid } from './utils.js';
import { screenToWorld, zoomAt, panBy } from './camera.js';
import { updateInspector } from './ui.js';

export function setupInput(canvas, camera, world, dom) {
  // Paint mode buttons
  const { btnDrawWalls, btnEraseWalls } = dom.buttons;
  function setPaintMode(mode) {
    const next = world.paintMode === mode ? "none" : mode;
    world.paintMode = next;
    if (btnDrawWalls)
      btnDrawWalls.classList.toggle("toggled", next === "draw");
    if (btnEraseWalls)
      btnEraseWalls.classList.toggle("toggled", next === "erase");
  }
  btnDrawWalls?.addEventListener("click", () => setPaintMode("draw"));
  btnEraseWalls?.addEventListener("click", () => setPaintMode("erase"));

  // Drag/paint state
  let dragging = false,
    lastX = 0,
    lastY = 0,
    allowDrag = false;
  let painting = false;
  let lastPaintKey = null;

  function paintAtEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const wpos = screenToWorld(camera, sx, sy);
    const x = Math.floor(wpos.x / CELL),
      y = Math.floor(wpos.y / CELL);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    const k = key(x, y);
    if (k === lastPaintKey) return;
    lastPaintKey = k;
    if (world.paintMode === "draw") {
      if (
        !world.walls.has(k) &&
        !world.farms.has(k) &&
        !world.flagCells.has(k) &&
        !world.crops.has(k) &&
        !world.agentsByCell.has(k)
      ) {
        const id = uuid();
        world.walls.set(k, { id, x, y, hp: 12, maxHp: 12 });
        if (typeof log === "function")
          try {
            log(world, "build", `Wall @${x},${y} (user)`, null, { x, y });
          } catch {}
      }
    } else if (world.paintMode === "erase") {
      if (world.walls.has(k)) {
        world.walls.delete(k);
        if (typeof log === "function")
          try {
            log(world, "destroy", `Wall @${x},${y} removed (user)`, null, {
              x,
              y,
            });
          } catch {}
      }
    }
  }

  function setAllowDrag(e) {
    allowDrag =
      e.buttons === 2 ||
      (e.buttons === 1 && (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey));
  }

  // Pointer events
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    setAllowDrag(e);
    if (allowDrag) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (e.button === 0 && !allowDrag && world.paintMode !== "none") {
      painting = true;
      lastPaintKey = null;
      paintAtEvent(e);
    }
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointermove", (e) => {
    setAllowDrag(e);
    if (dragging && allowDrag) {
      const dx = e.clientX - lastX,
        dy = e.clientY - lastY;
      panBy(camera, -dx, -dy);
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (painting && e.buttons & 1 && world.paintMode !== "none") {
      paintAtEvent(e);
    }
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
    painting = false;
    lastPaintKey = null;
  });

  // Wheel: trackpad 2-finger scroll → pan, pinch/Ctrl+wheel → zoom
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);

      // Normalize deltaMode (line/page → pixels)
      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.deltaMode === 1) { dx *= 16; dy *= 16; }
      if (e.deltaMode === 2) { dx *= 100; dy *= 100; }

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom (trackpad) or Ctrl+scroll (mouse) → zoom
        const factor = Math.pow(2, -dy * 0.01);
        zoomAt(camera, sx, sy, factor);
      } else {
        // Two-finger scroll (trackpad) or mouse wheel → pan
        panBy(camera, dx, dy);
      }
    },
    { passive: false }
  );

  // Touch: pinch-to-zoom and two-finger pan for mobile
  let lastTouchDist = 0;
  let lastTouchCenter = null;
  let touchStartPositions = new Map();

  canvas.addEventListener("touchstart", (e) => {
    for (const t of e.changedTouches) {
      touchStartPositions.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      lastTouchDist = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY
      );
      lastTouchCenter = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      const dist = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY
      );
      const center = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };

      // Pinch zoom
      if (lastTouchDist > 0) {
        const factor = dist / lastTouchDist;
        const rect = canvas.getBoundingClientRect();
        const zx = (center.x - rect.left) * (canvas.width / rect.width);
        const zy = (center.y - rect.top) * (canvas.height / rect.height);
        zoomAt(camera, zx, zy, factor);
      }

      // Two-finger pan
      if (lastTouchCenter) {
        const dx = center.x - lastTouchCenter.x;
        const dy = center.y - lastTouchCenter.y;
        panBy(camera, -dx, -dy);
      }

      lastTouchDist = dist;
      lastTouchCenter = center;
    }
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    for (const t of e.changedTouches) {
      touchStartPositions.delete(t.identifier);
    }
    if (e.touches.length < 2) {
      lastTouchDist = 0;
      lastTouchCenter = null;
    }
  });

  // Agent selection
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width,
      scaleY = canvas.height / rect.height;
    const sx = (e.clientX - rect.left) * scaleX,
      sy = (e.clientY - rect.top) * scaleY;
    const wpos = screenToWorld(camera, sx, sy);
    const x = Math.floor(wpos.x / CELL),
      y = Math.floor(wpos.y / CELL);
    if (x < 0 || y < 0 || x >= 62 || y >= 62) return;
    const id = world.agentsByCell.get(key(x, y));
    world.selectedId = id || null;
    updateInspector(world, dom.inspector);
  });
}
