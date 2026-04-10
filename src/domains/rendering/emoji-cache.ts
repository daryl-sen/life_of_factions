interface EmojiEntry {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

export class EmojiCache {
  private readonly _cache = new Map<string, EmojiEntry>();
  private readonly _tintCache = new Map<string, EmojiEntry>();
  private readonly _filterCache = new Map<string, EmojiEntry>();

  get(emoji: string): EmojiEntry {
    if (this._cache.has(emoji)) return this._cache.get(emoji)!;
    const pad = 64;
    const fontSize = 48;
    const tmp = document.createElement('canvas');
    tmp.width = pad * 2;
    tmp.height = pad * 2;
    const tc = tmp.getContext('2d')!;
    tc.font = `${fontSize}px serif`;
    tc.textAlign = 'center';
    tc.textBaseline = 'middle';
    tc.fillText(emoji, pad, pad);

    const imgData = tc.getImageData(0, 0, tmp.width, tmp.height);
    const d = imgData.data;
    let top = tmp.height, bottom = 0, left = tmp.width, right = 0;
    for (let py = 0; py < tmp.height; py++) {
      for (let px = 0; px < tmp.width; px++) {
        if (d[(py * tmp.width + px) * 4 + 3] > 10) {
          if (py < top) top = py;
          if (py > bottom) bottom = py;
          if (px < left) left = px;
          if (px > right) right = px;
        }
      }
    }

    const w = right - left + 1;
    const h = bottom - top + 1;
    const trimmed = document.createElement('canvas');
    trimmed.width = w;
    trimmed.height = h;
    trimmed.getContext('2d')!.drawImage(tmp, left, top, w, h, 0, 0, w, h);
    const entry: EmojiEntry = { canvas: trimmed, w, h };
    this._cache.set(emoji, entry);
    return entry;
  }

  getTinted(emoji: string, color: string): EmojiEntry {
    const cacheKey = emoji + color;
    if (this._tintCache.has(cacheKey)) return this._tintCache.get(cacheKey)!;
    const src = this.get(emoji);
    const c = document.createElement('canvas');
    c.width = src.w;
    c.height = src.h;
    const cx = c.getContext('2d')!;
    cx.drawImage(src.canvas, 0, 0);
    cx.globalCompositeOperation = 'source-in';
    cx.fillStyle = color;
    cx.fillRect(0, 0, c.width, c.height);
    const entry: EmojiEntry = { canvas: c, w: src.w, h: src.h };
    this._tintCache.set(cacheKey, entry);
    return entry;
  }

  /** Draw emoji centered at (x, y) in world-space coordinates */
  draw(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number): void {
    const entry = this.get(emoji);
    ctx.drawImage(entry.canvas, x - entry.w / 2, y - entry.h / 2);
  }

  /** Draw emoji centered at (x, y) scaled to fill size × size pixels */
  drawAt(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number): void {
    const entry = this.get(emoji);
    const scale = size / Math.max(entry.w, entry.h, 1);
    const dw = entry.w * scale;
    const dh = entry.h * scale;
    ctx.drawImage(entry.canvas, x - dw / 2, y - dh / 2, dw, dh);
  }

  getFiltered(emoji: string, filter: string): EmojiEntry {
    const cacheKey = emoji + '|' + filter;
    if (this._filterCache.has(cacheKey)) return this._filterCache.get(cacheKey)!;
    const src = this.get(emoji);
    const c = document.createElement('canvas');
    c.width = src.w;
    c.height = src.h;
    const cx = c.getContext('2d')!;
    cx.filter = filter;
    cx.drawImage(src.canvas, 0, 0);
    const entry: EmojiEntry = { canvas: c, w: src.w, h: src.h };
    this._filterCache.set(cacheKey, entry);
    return entry;
  }
}
