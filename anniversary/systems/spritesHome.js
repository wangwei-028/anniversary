import { PixelArt, makeCanvas, seededRandom, mixHex } from './pixel.js';
import { SPRITES, INK, registerBoss } from './sprites.js';

/**
 * 第 7 关 · 家 专属素材：邮筒 / 垃圾桶 / 家门 / 回忆走廊相框 / Boss 吞吞 / 雨夜街道墙面 / 夜空 / 路灯。
 * 回忆走廊的 21 个相框：已收集的碎片显示照片，没收集的显示模糊剪影（集齐后再走一遍全部点亮）。
 */
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';

function drawMailbox() {
  const a = new PixelArt(22, 34);
  a.rect(4, 6, 14, 22, '#2f9e5a');
  a.ellipse(11, 6, 7, 4, '#2f9e5a');
  a.rect(4, 12, 14, 2, '#ffd23f');
  a.rect(6, 16, 10, 2, '#1d6b3a');
  a.rect(9, 28, 4, 6, '#3b3550');
  a.rect(6, 32, 10, 2, '#3b3550');
  a.set(7, 5, '#7fe0a0');
  a.outline(INK);
  return a.toCanvas();
}

function drawTrashBins() {
  const a = new PixelArt(30, 16);
  for (const [x, col] of [
    [3, '#4fb3ff'],
    [16, '#5cc77a'],
  ]) {
    a.rect(x, 4, 11, 12, col);
    a.rect(x - 1, 2, 13, 3, mixHex(col, '#000000', 0.2));
    a.rect(x + 4, 1, 3, 1, '#3b3550');
    for (let y = 7; y < 15; y += 3) a.rect(x + 2, y, 7, 1, mixHex(col, '#ffffff', 0.35));
  }
  a.outline(INK);
  return a.toCanvas();
}

/** 家：暖黄灯光的小房子（终点 / 结局 / 群星之夜都用它） */
function drawHome() {
  const a = new PixelArt(60, 64);
  a.tri(2, 24, 58, 24, 30, 2, '#b5455a');
  a.tri(8, 22, 52, 22, 30, 6, '#d65a6e');
  a.rect(44, 6, 6, 12, '#8a5a4a');
  a.rect(6, 24, 48, 38, '#fff1d6');
  a.rect(6, 24, 48, 2, '#e8d2a8');
  // 窗户（暖光）
  for (const x of [10, 40]) {
    a.rect(x, 30, 10, 10, '#ffd27a');
    a.rect(x + 4, 30, 2, 10, '#c98a4b');
    a.rect(x, 34, 10, 2, '#c98a4b');
  }
  // 门 + 花环
  a.rect(23, 38, 14, 24, '#8a5a2b');
  a.rect(25, 40, 10, 20, '#ffd27a');
  a.set(33, 50, '#8a5a2b');
  a.ring(30, 34, 4, 4, 1.5, '#3fa35f');
  a.set(29, 33, '#ff4f6d');
  a.set(31, 33, '#ff4f6d');
  a.set(30, 34, '#ff4f6d');
  a.rect(2, 62, 56, 2, '#6b5a4a');
  a.outline(INK);
  return a.toCanvas();
}

/** 第 7 关终点的家门（跑到门前，门被撞开 → 最终 Boss 登场） */
function drawHomeDoor() {
  const c = makeCanvas(60, 64);
  const g = c.getContext('2d');
  g.drawImage(drawHome(), 0, 0);
  g.fillStyle = '#ffffff';
  g.font = 'bold 7px ' + FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('家', 30, 15);
  return c;
}

// ------------------------------------------------------------------
// 回忆走廊的相框
// ------------------------------------------------------------------

const FRAME_W = 26;
const FRAME_H = 32;
const photoImages = [];
let photoCollected = [];

function paintFrame(c, i) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, FRAME_W, FRAME_H);
  const got = !!photoCollected[i];
  // 相框（收集了的发金光）
  g.fillStyle = got ? '#ffd23f' : '#8a6a4a';
  g.fillRect(0, 0, FRAME_W, FRAME_H);
  g.fillStyle = got ? '#fff1a8' : '#a5845f';
  g.fillRect(1, 1, FRAME_W - 2, FRAME_H - 2);
  const ix = 3;
  const iy = 3;
  const iw = FRAME_W - 6;
  const ih = FRAME_H - 6;
  const img = photoImages[i];
  const ready = img && img.complete && img.naturalWidth > 0;
  g.fillStyle = '#2a2238';
  g.fillRect(ix, iy, iw, ih);
  if (ready) {
    // cover 裁切
    const s = Math.max(iw / img.naturalWidth, ih / img.naturalHeight);
    const sw = iw / s;
    const sh = ih / s;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    if (got) {
      g.imageSmoothingEnabled = true;
      g.drawImage(img, sx, sy, sw, sh, ix, iy, iw, ih);
    } else {
      // 模糊剪影：先缩到很小再放大，再压暗
      const tiny = makeCanvas(4, 5);
      const tg = tiny.getContext('2d');
      tg.drawImage(img, sx, sy, sw, sh, 0, 0, 4, 5);
      g.imageSmoothingEnabled = true;
      g.drawImage(tiny, ix, iy, iw, ih);
      g.fillStyle = 'rgba(30,18,50,0.55)';
      g.fillRect(ix, iy, iw, ih);
    }
  } else {
    g.fillStyle = got ? '#ffb3cf' : '#4a3a5a';
    g.fillRect(ix, iy, iw, ih);
  }
  if (!got) {
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.font = 'bold 10px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', FRAME_W / 2, FRAME_H / 2 + 1);
  }
  g.imageSmoothingEnabled = false;
}

/** 按存档里收集的碎片刷新 21 个相框（进第 7 关时调用；照片加载完成后也会自动刷新） */
export function refreshMemoryFrames(collected) {
  photoCollected = collected || photoCollected;
  const frames = SPRITES.memoryFrames;
  if (!frames) return;
  for (let i = 0; i < frames.length; i++) paintFrame(frames[i], i);
}

function buildMemoryFrames(photos) {
  const frames = [];
  for (let i = 0; i < photos.length; i++) {
    frames.push(makeCanvas(FRAME_W, FRAME_H));
    const img = new Image();
    img.onload = () => paintFrame(frames[i], i);
    img.src = photos[i].src;
    photoImages[i] = img;
  }
  SPRITES.memoryFrames = frames;
  refreshMemoryFrames([]);
}

// ------------------------------------------------------------------
// Boss · 吞吞（偷吃回忆的灰色小怪兽）
// ------------------------------------------------------------------

function drawTuntun(expr) {
  const a = new PixelArt(64, 60);
  const fur = '#8f8aa3';
  const dark = '#6f6a85';
  const light = '#b5b0c8';
  // 毛茸茸的身体
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    a.disc(32 + Math.cos(ang) * 22, 32 + Math.sin(ang) * 20, 5, dark);
  }
  a.ellipse(32, 32, 24, 22, fur);
  a.ellipse(26, 22, 8, 5, light);
  // 小角
  a.tri(16, 14, 22, 12, 15, 4, '#ffd27a');
  a.tri(48, 14, 42, 12, 49, 4, '#ffd27a');
  // 半透明的肚子：里面全是被吞掉的回忆光点
  a.ellipse(32, 40, 13, 10, '#4a4466');
  const rnd = seededRandom(expr.length * 7 + 3);
  for (let i = 0; i < 14; i++) {
    const x = 22 + Math.floor(rnd() * 20);
    const y = 33 + Math.floor(rnd() * 14);
    a.set(x, y, ['#ffe066', '#ffffff', '#ffb3cf', '#9fe3ff'][i % 4]);
  }
  // 眼睛
  const ey = 24;
  const ex1 = 25;
  const ex2 = 39;
  if (expr === 'dizzy') {
    for (const ex of [ex1, ex2]) {
      a.ring(ex, ey, 3.2, 3.2, 1, INK);
      a.set(ex, ey, INK);
    }
  } else if (expr === 'hurt') {
    a.line(ex1 - 3, ey - 2, ex1 + 1, ey, INK);
    a.line(ex1 + 1, ey, ex1 - 3, ey + 2, INK);
    a.line(ex2 + 3, ey - 2, ex2 - 1, ey, INK);
    a.line(ex2 - 1, ey, ex2 + 3, ey + 2, INK);
  } else {
    a.disc(ex1, ey, 3.5, '#ffffff');
    a.disc(ex2, ey, 3.5, '#ffffff');
    a.disc(ex1 + 1, ey + 1, 2, INK);
    a.disc(ex2 - 1, ey + 1, 2, INK);
    a.set(ex1, ey - 1, '#ffffff');
    a.set(ex2 - 2, ey - 1, '#ffffff');
    if (expr === 'angry') {
      a.line(ex1 - 4, ey - 6, ex1 + 3, ey - 3, INK);
      a.line(ex2 + 4, ey - 6, ex2 - 3, ey - 3, INK);
    }
  }
  // 大嘴（尖牙）
  const my = 31;
  if (expr === 'angry') {
    a.ellipse(32, my, 7, 3, '#3b1f3a');
    a.tri(27, my - 2, 29, my - 2, 28, my + 1, '#ffffff');
    a.tri(35, my - 2, 37, my - 2, 36, my + 1, '#ffffff');
  } else if (expr === 'dizzy') {
    for (let i = -4; i <= 4; i++) a.set(32 + i, my + ((i & 1) ? 1 : 0), INK);
  } else if (expr === 'hurt') {
    a.ring(32, my + 1, 3, 2.5, 1, INK);
  } else {
    a.rect(28, my, 9, 1, INK);
    a.set(30, my + 1, '#ffffff');
    a.set(34, my + 1, '#ffffff');
  }
  a.ellipse(20, 30, 2.5, 1.5, '#ff9cb8');
  a.ellipse(44, 30, 2.5, 1.5, '#ff9cb8');
  // 小脚
  a.ellipse(22, 54, 6, 3, dark);
  a.ellipse(42, 54, 6, 3, dark);
  a.outline(INK);
  return a;
}

// ------------------------------------------------------------------
// 墙面 / 夜空 / 路灯
// ------------------------------------------------------------------

function makeHomeWall(seed, store) {
  const W = 128;
  const H = 112;
  const a = new PixelArt(W, H);
  const rnd = seededRandom(seed);
  const walls = ['#e8d2a8', '#d9b8a0', '#c9b8d8', '#e0c4b0'];
  const roofs = ['#b5455a', '#5a6a9a', '#8a5a4a', '#4a7a6a'];
  const labels = [];
  for (let h = 0; h < 2; h++) {
    const x0 = h * 64;
    const top = 30 + Math.floor(rnd() * 20);
    const col = walls[(seed + h) % walls.length];
    a.tri(x0 - 2, top, x0 + 66, top, x0 + 32, top - 18, roofs[(seed + h) % roofs.length]);
    a.rect(x0 + 2, top, 60, H - top, col);
    if (store && h === 0) {
      // 24 小时便利店
      a.rect(x0 + 4, 70, 56, 10, '#3fa35f');
      a.rect(x0 + 4, 80, 56, 26, '#e6fff0');
      for (let x = x0 + 8; x < x0 + 58; x += 10) a.rect(x, 82, 6, 22, '#bff0d2');
      labels.push({ x: x0 + 32, y: 75, text: '24H 便利店' });
    } else {
      for (let y = top + 6; y < 96; y += 16) {
        for (let x = x0 + 8; x < x0 + 58; x += 18) {
          const lit = rnd() < 0.65;
          a.rect(x, y, 10, 10, lit ? '#ffd27a' : '#3a3450');
          a.rect(x + 4, y, 2, 10, mixHex(col, '#000000', 0.25));
        }
      }
      a.rect(x0 + 26, 92, 12, 20, '#8a5a2b');
      a.rect(x0 + 28, 94, 8, 6, '#ffd27a');
    }
  }
  a.rect(0, 106, W, 6, '#4a4252');
  const c = a.toCanvas();
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.font = 'bold 8px ' + FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const l of labels) g.fillText(l.text, l.x, l.y + 0.5);
  return c;
}

function makeHomeSky(palette) {
  const W = 256;
  const H = 128;
  const a = new PixelArt(W, H);
  for (let y = 0; y < H; y++) a.rect(0, y, W, 1, mixHex(palette.skyTop, palette.skyBottom, Math.pow(y / (H - 1), 1.4)));
  const rnd = seededRandom(77);
  for (let i = 0; i < 40; i++) a.set(Math.floor(rnd() * W), Math.floor(rnd() * 70), rnd() < 0.4 ? '#ffffff' : '#b9b4e8');
  a.disc(180, 28, 9, '#fff6d6');
  a.disc(176, 25, 2, '#f0e6c0');
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rnd() * W);
    const y = 30 + Math.floor(rnd() * 40);
    a.ellipse(x, y, 18, 4, mixHex('#3a3458', palette.fog, 0.3));
  }
  a.rect(0, H - 2, W, 2, palette.fog);
  return a.toCanvas();
}

function drawStreetLamp() {
  const a = new PixelArt(18, 52);
  a.rect(8, 10, 2, 42, '#3b3550');
  a.rect(5, 49, 8, 3, '#3b3550');
  a.rect(8, 8, 8, 2, '#3b3550');
  a.rect(12, 9, 6, 4, '#3b3550');
  a.rect(13, 12, 4, 2, '#fff1a8');
  a.outline(INK);
  const c = a.toCanvas();
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(15, 14, 1, 15, 14, 10);
  grad.addColorStop(0, 'rgba(255,230,140,0.55)');
  grad.addColorStop(1, 'rgba(255,230,140,0)');
  g.fillStyle = grad;
  g.fillRect(4, 4, 14, 22);
  return c;
}

/** 家关专属素材 */
export function buildHomeSprites(level, photos) {
  const S = SPRITES;
  S.mailbox = drawMailbox();
  S.trashBins = drawTrashBins();
  S.homeDoor = drawHomeDoor();
  S.homeHouse = drawHome();
  buildMemoryFrames(photos || []);

  const arts = {};
  for (const e of ['normal', 'angry', 'dizzy', 'hurt']) arts[e] = drawTuntun(e);
  registerBoss('tuntun', arts, [16, 8, 32, 32]);

  const walls = [makeHomeWall(1, true), makeHomeWall(2, false), makeHomeWall(3, false), makeHomeWall(4, false)];
  const lamp = drawStreetLamp();
  S.levelAssets[level.id] = { walls, signs: [lamp], sky: makeHomeSky(level.palette) };
  return S;
}
