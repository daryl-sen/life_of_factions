import { WORLD_PX } from '../../core/constants';
import { clamp } from '../../core/utils';
import type { ICameraState } from '../../core/types';

export class Camera implements ICameraState {
  x = 0;
  y = 0;
  scale = 1;
  min = 0.25;
  max = 4;
  viewW = 0;
  viewH = 0;

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx / this.scale + this.x, y: sy / this.scale + this.y };
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const w = this.screenToWorld(sx, sy);
    this.scale = clamp(this.scale * factor, this.min, this.max);
    this.x = w.x - sx / this.scale;
    this.y = w.y - sy / this.scale;
  }

  panBy(dx: number, dy: number): void {
    this.x += dx / this.scale;
    this.y += dy / this.scale;
    const slack = 40;
    const vw = this.viewW || window.innerWidth;
    const vh = this.viewH || window.innerHeight;
    const xMin = -slack;
    const xMax = WORLD_PX + slack - vw / this.scale;
    const yMin = -slack;
    const yMax = WORLD_PX + slack - vh / this.scale;
    // If viewport exceeds world, center the camera; otherwise clamp normally
    this.x = xMin < xMax ? clamp(this.x, xMin, xMax) : (WORLD_PX - vw / this.scale) / 2;
    this.y = yMin < yMax ? clamp(this.y, yMin, yMax) : (WORLD_PX - vh / this.scale) / 2;
  }

  fitToCanvas(canvas: HTMLCanvasElement): void {
    this.scale = clamp(
      Math.min(canvas.width / WORLD_PX, canvas.height / WORLD_PX),
      this.min,
      this.max
    );
    this.x = (WORLD_PX - canvas.width / this.scale) / 2;
    this.y = (WORLD_PX - canvas.height / this.scale) / 2;
    this.panBy(0, 0);
  }

  static setCanvasSize(canvas: HTMLCanvasElement): { w: number; h: number; dpr: number; cw: number; ch: number } {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const style = getComputedStyle(canvas);
    const cw = parseFloat(style.width) || window.innerWidth;
    const ch = parseFloat(style.height) || window.innerHeight;
    const w = Math.floor(cw * dpr);
    const h = Math.floor(ch * dpr);
    canvas.width = w;
    canvas.height = h;
    return { w, h, dpr, cw, ch };
  }
}
