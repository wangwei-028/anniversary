import { makeCanvas, seededRandom } from './pixel.js';
import { SPRITES } from './sprites.js';

/**
 * 结局 / 群星之夜 / 回忆放映厅共用的画面：星空、家、全体 Boss 合影。
 * 全部画在低分辨率像素缓冲上（或离屏 Canvas 上，作为放映厅第 22 张照片）。
 */
const STAR_SEED = 2025;
let starCache = null;

function stars(W, H) {
  if (starCache && starCache.W === W && starCache.H === H) return starCache.list;
  const rnd = seededRandom(STAR_SEED);
  const list = [];
  for (let i = 0; i < 90; i++) list.push({ x: rnd() * W, y: rnd() * H * 0.75, p: rnd() * 6, big: rnd() < 0.12 });
  starCache = { W, H, list };
  return list;
}

/** 夜空：深蓝渐变 + 闪烁的星星 */
export function drawNightSky(g, W, H, t) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0b0a24');
  grad.addColorStop(0.6, '#2a1d4f');
  grad.addColorStop(1, '#4a2a5c');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  for (const s of stars(W, H)) {
    const a = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.3 + s.p));
    g.globalAlpha = a;
    g.fillStyle = s.big ? '#fff6c2' : '#ffffff';
    g.fillRect(Math.round(s.x), Math.round(s.y), s.big ? 2 : 1, s.big ? 2 : 1);
  }
  g.globalAlpha = 1;
}

/** 地面 + 家 */
export function drawHomeScene(g, W, H, glow) {
  const groundY = Math.round(H * 0.74);
  g.fillStyle = '#1d1630';
  g.fillRect(0, groundY, W, H - groundY);
  g.fillStyle = '#2a2040';
  g.fillRect(0, groundY, W, 2);
  const house = SPRITES.homeHouse;
  if (house) {
    const x = Math.round(W / 2 - house.width / 2);
    const y = groundY - house.height + 2;
    if (glow > 0) {
      const rg = g.createRadialGradient(W / 2, y + 40, 4, W / 2, y + 40, 60);
      rg.addColorStop(0, 'rgba(255,214,122,' + 0.45 * glow + ')');
      rg.addColorStop(1, 'rgba(255,214,122,0)');
      g.fillStyle = rg;
      g.fillRect(0, y - 20, W, 120);
    }
    g.drawImage(house, x, y);
  }
  return groundY;
}

/** 7 只 Boss 的合影站位（k = 赶来的进度 0~1，每只错开一点） */
const LINEUP = [
  { key: 'meow', row: 0, slot: 0 },
  { key: 'kong', row: 0, slot: 1 },
  { key: 'bo', row: 0, slot: 2 },
  { key: 'mumu', row: 0, slot: 3 },
  { key: 'zhang', row: 1, slot: 0 },
  { key: 'crab', row: 1, slot: 2 },
  { key: 'tuntun', row: 1, slot: 3 },
];

export function drawLineup(g, W, H, k, t) {
  const groundY = Math.round(H * 0.74);
  const S = SPRITES;
  g.imageSmoothingEnabled = false;
  for (let i = 0; i < LINEUP.length; i++) {
    const L = LINEUP[i];
    const set = S.bosses[L.key];
    if (!set) continue;
    const img = set.normal;
    const sc = L.row === 0 ? 0.42 : 0.5;
    const w = Math.round(img.width * sc);
    const h = Math.round(img.height * sc);
    const tx = L.row === 0 ? W * (0.13 + L.slot * 0.248) : W * (0.12 + L.slot * 0.255);
    const ty = L.row === 0 ? groundY - 2 : H * 0.9;
    const kk = Math.max(0, Math.min(1, k * 1.6 - i * 0.09));
    const fromLeft = i % 2 === 0;
    const sx = fromLeft ? -w : W + w;
    const x = sx + (tx - sx) * (1 - (1 - kk) * (1 - kk));
    const bob = kk < 1 ? Math.abs(Math.sin(t * 10 + i)) * 3 : Math.sin(t * 2 + i) * 0.8;
    g.drawImage(img, Math.round(x - w / 2), Math.round(ty - h - bob), w, h);
  }
}

/** 主角两人站在家门口（正面） */
export function drawCouple(g, W, H, alpha, t) {
  const S = SPRITES;
  const groundY = Math.round(H * 0.74);
  const y = Math.round(H * 0.9) - 32;
  g.globalAlpha = alpha;
  const gi = Math.floor(t * 2) & 1 ? S.girlFront.idle1 : S.girlFront.idle0;
  const bi = Math.floor(t * 2 + 1) & 1 ? S.boyFront.idle1 : S.boyFront.idle0;
  g.drawImage(gi, Math.round(W / 2 - 34), y, 32, 32);
  g.drawImage(bi, Math.round(W / 2 + 2), y, 32, 32);
  g.globalAlpha = 1;
  return groundY;
}

/** 放映厅第 22 张照片「群星之夜」：静态合影 */
export function makeGroupPhoto(W = 180, H = 240) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  drawNightSky(g, W, H, 1.2);
  // 烟花拼出的 ∞
  g.strokeStyle = '#ffe066';
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const x = W / 2 + (Math.cos(a) * W * 0.22) / (1 + Math.sin(a) * Math.sin(a));
    const y = H * 0.2 + (Math.sin(a) * Math.cos(a) * W * 0.22) / (1 + Math.sin(a) * Math.sin(a));
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  drawHomeScene(g, W, H, 1);
  drawLineup(g, W, H, 1, 0);
  drawCouple(g, W, H, 1, 0);
  return c;
}

/** 把一段文字渲染成点阵，返回点坐标（烟花拼字用） */
export function textPoints(text, size, step) {
  const w = Math.ceil(size * text.length * 0.9) + 4;
  const h = Math.ceil(size * 1.2);
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.font = 'bold ' + size + 'px "Arial Black", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2);
  const data = g.getImageData(0, 0, w, h).data;
  const pts = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] > 128) pts.push({ x: x - w / 2, y: y - h / 2 });
    }
  }
  // 字体渲染不出来时退化成一个圆环，保证烟花有落点
  if (!pts.length) {
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      pts.push({ x: Math.cos(a) * size * 0.5, y: Math.sin(a) * size * 0.35 });
    }
  }
  return pts;
}
