/**
 * 像素画工具：在一块 Uint32 像素数组上画点、矩形、圆、三角形、像素字，
 * 最后自动描边并转成离屏 Canvas。所有角色 / 障碍 / UI 图标都用它程序化生成。
 */

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  return c;
}

/** '#rrggbb' → 小端 ABGR 打包的 32 位颜色（ImageData 用） */
export function packColor(hex, alpha = 255) {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 两个 '#rrggbb' 颜色按 t 混合，返回 '#rrggbb' */
export function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const r = Math.round(A[0] + (B[0] - A[0]) * t);
  const g = Math.round(A[1] + (B[1] - A[1]) * t);
  const bl = Math.round(A[2] + (B[2] - A[2]) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

/** 3×5 像素小字（只收录用到的字符） */
const GLYPHS = {
  S: ['111', '100', '111', '001', '111'],
  A: ['010', '101', '111', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  O: ['111', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  B: ['110', '101', '110', '101', '110'],
  U: ['101', '101', '101', '101', '111'],
  T: ['111', '010', '010', '010', '010'],
  M: ['101', '111', '111', '101', '101'],
  R: ['110', '101', '110', '101', '101'],
  P: ['110', '101', '110', '100', '100'],
  N: ['101', '111', '111', '101', '101'],
  K: ['101', '101', '110', '101', '101'],
  H: ['101', '101', '111', '101', '101'],
  C: ['111', '100', '100', '100', '111'],
  I: ['111', '010', '010', '010', '111'],
  G: ['111', '100', '101', '101', '111'],
  Y: ['101', '101', '010', '010', '010'],
  W: ['101', '101', '111', '111', '101'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '8': ['111', '101', '111', '101', '111'],
  x: ['000', '101', '010', '101', '000'],
  '?': ['111', '001', '011', '000', '010'],
  '%': ['101', '001', '010', '100', '101'],
  '!': ['010', '010', '010', '000', '010'],
  '^': ['010', '111', '101', '000', '000'],
  u: ['010', '111', '010', '010', '010'], // ↑
  d: ['010', '010', '010', '111', '010'], // ↓
  ' ': ['000', '000', '000', '000', '000'],
};

export class PixelArt {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = new Uint32Array(w * h);
  }

  static color(c) {
    return typeof c === 'string' ? packColor(c) : c;
  }

  set(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf[y * this.w + x] = PixelArt.color(c);
  }

  clear(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf[y * this.w + x] = 0;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.buf[y * this.w + x];
  }

  rect(x, y, w, h, c) {
    const col = PixelArt.color(c);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
  }

  clearRect(x, y, w, h) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.clear(x + i, y + j);
  }

  /** 实心圆（圆心可为小数，像素中心判定） */
  disc(cx, cy, r, c) {
    const col = PixelArt.color(c);
    const r2 = r * r;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, col);
      }
    }
  }

  clearDisc(cx, cy, r) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this.clear(x, y);
      }
    }
  }

  /** 实心椭圆 */
  ellipse(cx, cy, rx, ry, c) {
    const col = PixelArt.color(c);
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, col);
      }
    }
  }

  /** 椭圆环（描边） */
  ring(cx, cy, rx, ry, thickness, c) {
    const col = PixelArt.color(c);
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        const ix = (x + 0.5 - cx) / Math.max(0.5, rx - thickness);
        const iy = (y + 0.5 - cy) / Math.max(0.5, ry - thickness);
        if (d <= 1 && ix * ix + iy * iy > 1) this.set(x, y, col);
      }
    }
  }

  /** Bresenham 直线 */
  line(x0, y0, x1, y1, c) {
    const col = PixelArt.color(c);
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** 实心三角形 */
  tri(x0, y0, x1, y1, x2, y2, c) {
    const col = PixelArt.color(c);
    const minX = Math.floor(Math.min(x0, x1, x2));
    const maxX = Math.ceil(Math.max(x0, x1, x2));
    const minY = Math.floor(Math.min(y0, y1, y2));
    const maxY = Math.ceil(Math.max(y0, y1, y2));
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
        const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 >= -0.01 && w1 >= -0.01 && w2 >= -0.01) this.set(x, y, col);
      }
    }
  }

  /** 3×5 像素字 */
  text(str, x, y, c) {
    const col = PixelArt.color(c);
    let cx = x;
    for (const ch of str) {
      const g = GLYPHS[ch];
      if (g) {
        for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '1') this.set(cx + i, y + j, col);
      }
      cx += 4;
    }
  }

  static textWidth(str) {
    return str.length * 4 - 1;
  }

  /** 自动描边：所有与不透明像素相邻（上下左右）的透明像素涂成描边色 */
  outline(c, diagonal = false) {
    const col = PixelArt.color(c);
    const w = this.w;
    const h = this.h;
    const src = this.buf.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] !== 0) continue;
        let near = false;
        if (x > 0 && src[y * w + x - 1] !== 0) near = true;
        else if (x < w - 1 && src[y * w + x + 1] !== 0) near = true;
        else if (y > 0 && src[(y - 1) * w + x] !== 0) near = true;
        else if (y < h - 1 && src[(y + 1) * w + x] !== 0) near = true;
        else if (diagonal) {
          if (x > 0 && y > 0 && src[(y - 1) * w + x - 1] !== 0) near = true;
          else if (x < w - 1 && y > 0 && src[(y - 1) * w + x + 1] !== 0) near = true;
          else if (x > 0 && y < h - 1 && src[(y + 1) * w + x - 1] !== 0) near = true;
          else if (x < w - 1 && y < h - 1 && src[(y + 1) * w + x + 1] !== 0) near = true;
        }
        if (near) this.buf[y * w + x] = col;
      }
    }
    return this;
  }

  /** 复制一份，所有不透明像素换成同一种颜色（受击闪白 / 剪影用） */
  silhouette(c) {
    const col = PixelArt.color(c);
    const out = new PixelArt(this.w, this.h);
    for (let i = 0; i < this.buf.length; i++) if (this.buf[i] !== 0) out.buf[i] = col;
    return out;
  }

  /** 水平翻转 */
  flipped() {
    const out = new PixelArt(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.buf[y * this.w + x] = this.buf[y * this.w + (this.w - 1 - x)];
    return out;
  }

  toCanvas() {
    const c = makeCanvas(this.w, this.h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.buf);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

/** 一个简单的可复现随机数（素材生成用，保证每次打开花纹一致） */
export function seededRandom(seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
