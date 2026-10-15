import { PixelArt, seededRandom, mixHex } from './pixel.js';
import { SPRITES, INK, registerBoss } from './sprites.js';
import { makeSignpost } from './spritesZoo.js';

/**
 * 第 4 关 · 游乐园 专属像素素材：障碍 / Boss 木木 / 弹幕 / 两侧游乐设施墙面 / 天空 / 路边指路牌。
 * 墙面贴图 128×96 对应 12m 长 × 9m 高（顶部透明 = 露出天空）。
 */
const CANDY = ['#ff6fa5', '#ffd23f', '#4fb3ff', '#5cc77a', '#a77bff', '#ff8a3c'];

// ------------------------------------------------------------------
// 障碍
// ------------------------------------------------------------------

function drawBalloons() {
  const a = new PixelArt(22, 26);
  const cols = ['#ff4f6d', '#ffd23f', '#4fb3ff', '#a77bff'];
  const pos = [
    [6, 5],
    [15, 4],
    [10, 9],
    [17, 11],
  ];
  for (let i = 0; i < pos.length; i++) {
    const [x, y] = pos[i];
    a.line(x, y + 4, 11, 21, '#8a7a90');
  }
  for (let i = 0; i < pos.length; i++) {
    const [x, y] = pos[i];
    a.ellipse(x, y, 3.6, 4.2, cols[i]);
    a.set(x - 1, y - 2, '#ffffff');
    a.set(x, y + 4, mixHex(cols[i], '#000000', 0.25));
  }
  // 小沙袋
  a.rect(8, 21, 7, 5, '#c98a4b');
  a.rect(8, 21, 7, 1, '#e8b56a');
  a.outline(INK);
  return a.toCanvas();
}

/** 旋转茶杯（3 帧：杯把转到不同位置） */
function drawTeacup(frame) {
  const a = new PixelArt(36, 30);
  const body = '#ff8cba';
  const dark = '#e5609a';
  // 底盘
  a.ellipse(18, 26, 17, 3.5, '#ffd23f');
  a.ellipse(18, 25, 15, 2.5, '#fff1a8');
  // 杯身
  for (let y = 8; y < 25; y++) {
    const t = (y - 8) / 17;
    const half = Math.round(14 - t * t * 6);
    a.rect(18 - half, y, half * 2, 1, body);
  }
  a.ellipse(18, 8, 14, 3, '#ffffff');
  a.ellipse(18, 8, 12, 2, '#ffd6e7');
  // 波点（随帧转动）
  for (let i = 0; i < 4; i++) {
    const x = 8 + ((i * 7 + frame * 3) % 22);
    a.disc(x, 15 + (i % 2) * 4, 1.6, '#ffffff');
  }
  // 杯把
  const hx = frame === 0 ? 33 : frame === 1 ? 31 : 3;
  a.ring(hx, 14, 3, 4, 1.5, dark);
  // 坐在杯里的小人影
  a.disc(14, 5, 2.5, '#ffd9bf');
  a.disc(22, 5, 2.5, '#ffd9bf');
  a.rect(12, 2, 5, 2, '#6b3b2a');
  a.rect(20, 2, 5, 2, '#2b2230');
  a.outline(INK);
  return a.toCanvas();
}

/** 摩天轮横梁（滑铲钻过） */
function drawFerrisBeam(lanes) {
  const w = Math.round(lanes * 38.4) + 2;
  const a = new PixelArt(w, 36);
  const steel = '#e8eaf2';
  const red = '#ff4f6d';
  a.rect(1, 1, 3, 35, steel);
  a.rect(w - 4, 1, 3, 35, steel);
  a.rect(2, 1, 1, 35, '#ffffff');
  a.rect(3, 1, w - 6, 3, red);
  a.rect(3, 13, w - 6, 3, red);
  for (let x = 3; x < w - 6; x += 6) {
    a.line(x, 4, x + 6, 12, steel);
    a.line(x + 6, 4, x, 12, steel);
  }
  for (let x = 6; x < w - 4; x += 8) a.set(x, 2, '#ffe066');
  a.outline(INK);
  return a.toCanvas();
}

/** 摩天轮立柱 */
function drawFerrisPillar() {
  const a = new PixelArt(28, 44);
  for (let y = 0; y < 42; y++) {
    const half = 4 + Math.floor((y / 42) * 8);
    a.rect(14 - half, y, 2, 1, '#ff4f6d');
    a.rect(13 + half, y, 2, 1, '#ff4f6d');
  }
  for (let y = 4; y < 42; y += 6) {
    const half = 4 + Math.floor((y / 42) * 8);
    a.line(14 - half, y, 14 + half, y + 5, '#ffffff');
    a.line(14 + half, y, 14 - half, y + 5, '#ffffff');
  }
  a.disc(14, 3, 3, '#ffd23f');
  a.rect(2, 41, 24, 3, '#8f9bb3');
  a.outline(INK);
  return a.toCanvas();
}

/** 小丑彩带卷（4 帧旋转） */
function drawRibbon(frame) {
  const a = new PixelArt(20, 20);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + (frame * Math.PI) / 6;
    const col = CANDY[i % CANDY.length];
    for (let r = 2; r < 9; r++) {
      const x = 10 + Math.cos(ang + r * 0.25) * r;
      const y = 10 + Math.sin(ang + r * 0.25) * r;
      a.rect(x, y, 2, 2, col);
    }
  }
  a.disc(10, 10, 2.5, '#ffffff');
  a.set(10, 10, '#ff4f6d');
  a.outline(INK);
  return a.toCanvas();
}

// ------------------------------------------------------------------
// Boss · 木木（失控旋转木马）+ 弹幕
// ------------------------------------------------------------------

function drawHorseBody(a, ox, oy, s, expr, mane) {
  const white = '#fff6fa';
  const shade = '#e9d6e2';
  const px = (x) => ox + x * s;
  const py = (y) => oy + y * s;
  // 身体
  a.ellipse(px(14), py(16), 9 * s, 5 * s, white);
  a.ellipse(px(14), py(18), 8 * s, 2.5 * s, shade);
  // 腿（前腿抬起：腾跃）
  a.rect(px(7), py(19), 2 * s, 7 * s, white);
  a.rect(px(18), py(19), 2 * s, 7 * s, white);
  a.line(px(20), py(15), px(25), py(19), white);
  a.line(px(21), py(15), px(26), py(19), white);
  a.rect(px(7), py(25), 2 * s, 1 * s + 1, '#ffd23f');
  a.rect(px(18), py(25), 2 * s, 1 * s + 1, '#ffd23f');
  // 脖子 + 头（朝右）
  a.rect(px(19), py(6), 4 * s, 9 * s, white);
  a.ellipse(px(24), py(6), 4.5 * s, 3 * s, white);
  a.rect(px(26), py(6), 3 * s, 2 * s, white);
  a.set(px(28), py(7), INK);
  // 耳朵
  a.set(px(21), py(2), white);
  a.set(px(21), py(3), white);
  // 鬃毛（彩虹）
  for (let i = 0; i < 6; i++) a.rect(px(17 - i * 0.2), py(3 + i * 2), 2 * s, 2 * s, mane[i % mane.length]);
  // 尾巴
  for (let i = 0; i < 4; i++) a.rect(px(4 - i), py(14 + i * 2), 2 * s, 2 * s, mane[(i + 2) % mane.length]);
  // 马鞍
  a.rect(px(11), py(11), 6 * s, 3 * s, '#ff6fa5');
  a.rect(px(11), py(13), 6 * s, 1 * s, '#c42a62');
  // 眼睛
  const ex = px(24);
  const ey = py(5);
  if (expr === 'dizzy') {
    a.ring(ex, ey, 1.6 * s, 1.6 * s, 1, INK);
    a.set(ex, ey, INK);
  } else if (expr === 'hurt') {
    a.line(ex - 1, ey - 1, ex + 1, ey + 1, INK);
    a.line(ex + 1, ey - 1, ex - 1, ey + 1, INK);
  } else {
    a.rect(ex, ey - 1, s, 2 * s, INK);
    if (expr === 'angry') a.line(ex - 2, ey - 3, ex + 2, ey - 2, INK);
  }
  a.set(px(25), py(8), '#ff9cb8');
}

function drawMumu(expr) {
  const a = new PixelArt(64, 62);
  // 金色立杆 + 小顶棚
  a.rect(30, 0, 3, 62, '#ffd23f');
  a.rect(31, 0, 1, 62, '#fff1a8');
  a.tri(14, 9, 50, 9, 32, 0, '#ff4f6d');
  for (let x = 16; x < 50; x += 6) a.tri(x, 9, x + 3, 9, 32, 1, '#ffffff');
  a.rect(14, 9, 37, 2, '#ffd23f');
  for (let x = 16; x < 50; x += 5) a.set(x, 10, '#ffffff');
  drawHorseBody(a, 4, 18, 2, expr, ['#ff6fa5', '#ffd23f', '#4fb3ff', '#a77bff']);
  // 底座
  a.rect(18, 58, 28, 4, '#c98a4b');
  a.outline(INK);
  return a;
}

/** 木马弹幕（2 帧上下） */
function drawHorse(frame) {
  const a = new PixelArt(32, 36);
  a.rect(15, 0, 2, 36, '#ffd23f');
  drawHorseBody(a, 2, 6 - frame, 1, 'normal', ['#ff6fa5', '#4fb3ff', '#ffd23f']);
  a.outline(INK);
  return a.toCanvas();
}

function drawRing() {
  const a = new PixelArt(16, 16);
  a.ring(8, 8, 6.5, 6.5, 2.5, '#ff6fa5');
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    a.set(8 + Math.cos(ang) * 5.5, 8 + Math.sin(ang) * 5.5, i % 2 ? '#ffd23f' : '#ffffff');
  }
  a.outline(INK);
  return a.toCanvas();
}

/** 转盘横扫（拉伸成三道宽，2 帧灯光闪烁） */
function drawSpinSweep(frame) {
  const w = 118;
  const h = 26;
  const a = new PixelArt(w, h);
  a.rect(0, 8, w, 14, '#ff8cba');
  a.rect(0, 8, w, 3, '#ffffff');
  a.rect(0, 19, w, 3, '#c42a62');
  for (let x = 2; x < w; x += 8) {
    a.disc(x + (frame ? 4 : 0), 15, 2, (x / 8 + frame) % 2 ? '#ffe066' : '#ffffff');
  }
  for (let x = 0; x < w; x += 12) a.rect(x, 0, 2, 8, '#ffd23f');
  for (let x = 0; x < w; x++) if (x % 4 !== 3) a.set(x, h - 1, '#ff2d55');
  a.outline(INK);
  return a.toCanvas();
}

// ------------------------------------------------------------------
// 墙面 / 天空 / 装饰
// ------------------------------------------------------------------

function makeParkWall(seed, kind) {
  const W = 128;
  const H = 96;
  const a = new PixelArt(W, H);
  const rnd = seededRandom(seed);
  if (kind === 'ferris') {
    const cx = 64;
    const cy = 44;
    a.ring(cx, cy, 36, 36, 2, '#ff6fa5');
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      a.line(cx, cy, cx + Math.cos(ang) * 35, cy + Math.sin(ang) * 35, '#ffd6e7');
      a.rect(cx + Math.cos(ang) * 36 - 3, cy + Math.sin(ang) * 36 - 2, 6, 5, CANDY[i % CANDY.length]);
    }
    a.disc(cx, cy, 4, '#ffd23f');
    a.line(cx, cy, cx - 20, 90, '#e8eaf2');
    a.line(cx, cy, cx + 20, 90, '#e8eaf2');
  } else if (kind === 'coaster') {
    for (let x = 0; x < W; x++) {
      const y = Math.round(40 + Math.sin((x / W) * Math.PI * 2) * 22);
      a.rect(x, y, 1, 3, '#ff4f6d');
      if (x % 10 === 0) a.rect(x, y + 3, 2, 90 - y, '#e8eaf2');
    }
    a.rect(20, 52, 12, 6, '#ffd23f');
    a.rect(34, 50, 12, 6, '#4fb3ff');
  } else if (kind === 'carousel') {
    a.tri(24, 40, 104, 40, 64, 10, '#ff8cba');
    for (let i = 0; i < 8; i++) a.tri(24 + i * 10, 40, 29 + i * 10, 40, 64, 11, i % 2 ? '#ffffff' : '#ff6fa5');
    a.rect(28, 40, 72, 4, '#ffd23f');
    for (let x = 30; x < 100; x += 6) a.set(x, 42, '#ffffff');
    a.rect(30, 44, 68, 36, '#fff1f6');
    for (let x = 34; x < 98; x += 12) {
      a.rect(x, 44, 1, 36, '#ffd23f');
      a.ellipse(x + 3, 60 + ((x / 12) % 2) * 4, 4, 2.5, '#ffffff');
    }
  } else {
    // 糖果条纹帐篷
    for (let i = 0; i < 3; i++) {
      const x0 = 6 + i * 42;
      const top = 30 + Math.floor(rnd() * 14);
      a.tri(x0, top + 14, x0 + 36, top + 14, x0 + 18, top - 4, CANDY[(i + seed) % CANDY.length]);
      a.rect(x0 + 2, top + 14, 32, 90 - top - 14, '#ffffff');
      for (let x = x0 + 2; x < x0 + 34; x += 6) a.rect(x, top + 14, 3, 90 - top - 14, CANDY[(i + seed) % CANDY.length]);
      a.rect(x0 + 12, top + 30, 12, 90 - top - 30, '#3b1f3a');
      a.set(x0 + 18, top - 6, '#ffd23f');
      a.set(x0 + 18, top - 5, '#ffd23f');
    }
  }
  // 灌木 + 白色栅栏
  for (let x = -4; x < W + 4; x += 9) {
    a.disc(x + 4, 84, 6 + Math.floor(rnd() * 2), '#5cc77a');
    a.disc(x + 3, 82, 3, '#8fe08f');
  }
  a.rect(0, 86, W, 10, '#5cc77a');
  for (let x = 1; x < W; x += 6) {
    a.rect(x, 82, 3, 14, '#ffffff');
    a.set(x + 1, 81, '#ffffff');
  }
  a.rect(0, 86, W, 2, '#ffffff');
  a.rect(0, 91, W, 2, '#ffffff');
  return a.toCanvas();
}

function makeParkSky(palette) {
  const W = 256;
  const H = 128;
  const a = new PixelArt(W, H);
  for (let y = 0; y < H; y++) a.rect(0, y, W, 1, mixHex(palette.skyTop, palette.skyBottom, Math.min(1, (y / (H - 1)) * 1.1)));
  const rnd = seededRandom(41);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rnd() * W);
    const y = 16 + Math.floor(rnd() * 40);
    a.ellipse(x, y, 13, 4, '#ffffff');
    a.disc(x - 4, y - 3, 5, '#ffffff');
    a.disc(x + 5, y - 3, 4, '#ffffff');
  }
  // 远处飘走的气球
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(rnd() * W);
    const y = 10 + Math.floor(rnd() * 60);
    a.ellipse(x, y, 2, 2.5, CANDY[i % CANDY.length]);
    a.set(x, y + 3, '#8a7a90');
  }
  // 远处的摩天轮剪影
  const far = mixHex('#ff9cc4', palette.fog, 0.5);
  a.ring(190, 92, 26, 26, 1.5, far);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    a.line(190, 92, 190 + Math.cos(ang) * 25, 92 + Math.sin(ang) * 25, far);
  }
  a.rect(0, H - 6, W, 6, mixHex('#9be07a', palette.fog, 0.55));
  a.rect(0, H - 2, W, 2, palette.fog);
  return a.toCanvas();
}

function drawBalloonLamp() {
  const a = new PixelArt(16, 44);
  a.rect(7, 12, 2, 32, '#8f9bb3');
  a.rect(5, 41, 6, 3, '#8f9bb3');
  a.ellipse(4, 6, 3, 4, '#ff4f6d');
  a.ellipse(12, 5, 3, 4, '#4fb3ff');
  a.ellipse(8, 3, 3, 3.5, '#ffd23f');
  a.line(4, 10, 8, 13, '#8a7a90');
  a.line(12, 9, 8, 13, '#8a7a90');
  a.outline(INK);
  return a.toCanvas();
}

/** 游乐园关专属素材 */
export function buildParkSprites(level, signs) {
  const S = SPRITES;
  S.balloons = drawBalloons();
  S.teacup = [drawTeacup(0), drawTeacup(1), drawTeacup(2)];
  S.ferrisBeam = [null, drawFerrisBeam(1), drawFerrisBeam(2), drawFerrisBeam(3)];
  S.ferrisPillar = drawFerrisPillar();
  S.ribbon = [drawRibbon(0), drawRibbon(1), drawRibbon(2), drawRibbon(3)];
  S.horse = [drawHorse(0), drawHorse(1)];
  S.ring = drawRing();
  S.spinSweep = [drawSpinSweep(0), drawSpinSweep(1)];

  const arts = {};
  for (const e of ['normal', 'angry', 'dizzy', 'hurt']) arts[e] = drawMumu(e);
  registerBoss('mumu', arts, [32, 18, 32, 32]);

  const walls = [makeParkWall(5, 'ferris'), makeParkWall(9, 'tents'), makeParkWall(13, 'coaster'), makeParkWall(17, 'carousel')];
  const names = signs && signs.length ? signs : ['游乐园'];
  const lamp = drawBalloonLamp();
  const list = [];
  for (let i = 0; i < names.length; i++) {
    list.push(makeSignpost(names[i], CANDY[i % CANDY.length]));
    list.push(lamp);
  }
  S.levelAssets[level.id] = { walls, signs: list, sky: makeParkSky(level.palette) };
  return S;
}
