import { CELL, GRID } from './constants.js';
import { key, clamp, log } from './utils.js';
import { screenToWorld, zoomAt, panBy } from './camera.js';
import { qs, updateInspector } from './ui.js';

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
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "w_" + Math.random().toString(36).slice(2);
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

  // Wheel zoom
  canvas.addEventListener(
    "wheel",
    (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      const dir = e.deltaY < 0 ? 1 : -1;
      camera._levelIdx = clamp(
        camera._levelIdx + dir,
        0,
        camera._levels.length - 1
      );
      const target = camera._levels[camera._levelIdx];
      const ratio = target / camera.scale;
      zoomAt(camera, sx, sy, ratio);
      e.preventDefault();
    },
    { passive: false }
  );

  // NavPad buttons
  const stepWorld = CELL * 6;
  function zoomCenter(factor) {
    zoomAt(camera, canvas.width / 2, canvas.height / 2, factor);
  }
  qs("#btnPanUp")?.addEventListener("click", () =>
    panBy(camera, 0, -stepWorld * camera.scale)
  );
  qs("#btnPanDown")?.addEventListener("click", () =>
    panBy(camera, 0, stepWorld * camera.scale)
  );
  qs("#btnPanLeft")?.addEventListener("click", () =>
    panBy(camera, -stepWorld * camera.scale, 0)
  );
  qs("#btnPanRight")?.addEventListener("click", () =>
    panBy(camera, stepWorld * camera.scale, 0)
  );
  qs("#btnZoomIn")?.addEventListener("click", () => {
    camera._levelIdx = clamp(
      (camera._levelIdx ?? 2) + 1,
      0,
      (camera._levels?.length || 1) - 1
    );
    const target = camera._levels[camera._levelIdx];
    zoomCenter(target / camera.scale);
  });
  qs("#btnZoomOut")?.addEventListener("click", () => {
    camera._levelIdx = clamp(
      (camera._levelIdx ?? 2) - 1,
      0,
      (camera._levels?.length || 1) - 1
    );
    const target = camera._levels[camera._levelIdx];
    zoomCenter(target / camera.scale);
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
