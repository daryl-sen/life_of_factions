import { WORLD_PX } from './constants.js';
import { clamp } from './utils.js';

export function makeCamera() {
  return { x: 0, y: 0, scale: 1, min: 0.25, max: 4 };
}

export function setCanvasSize(canvas) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  return { w, h, dpr };
}

export function fitScaleForCanvas(canvas) {
  return Math.min(canvas.width / WORLD_PX, canvas.height / WORLD_PX);
}

export function screenToWorld(camera, sx, sy) {
  return { x: sx / camera.scale + camera.x, y: sy / camera.scale + camera.y };
}

export function zoomAt(camera, sx, sy, factor) {
  const w = screenToWorld(camera, sx, sy);
  const newScale = clamp(camera.scale * factor, camera.min, camera.max);
  camera.scale = newScale;
  camera.x = w.x - sx / camera.scale;
  camera.y = w.y - sy / camera.scale;
}

export function panBy(camera, dx, dy) {
  camera.x += dx / camera.scale;
  camera.y += dy / camera.scale;
  const slack = 40;
  camera.x = clamp(
    camera.x,
    -slack,
    WORLD_PX + slack - window.innerWidth / camera.scale
  );
  camera.y = clamp(
    camera.y,
    -slack,
    WORLD_PX + slack - window.innerHeight / camera.scale
  );
}
