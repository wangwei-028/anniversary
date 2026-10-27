import { PixelArt, seededRandom, mixHex } from './pixel.js';
import { SPRITES, INK, registerBoss } from './sprites.js';
import { makeSignpost } from './spritesZoo.js';

/**
 * 第 6 关 · 海边 专属像素素材：障碍 / Boss 蟹老板 / 弹幕 / 两侧海浪椰树墙面 / 天空 / 遮阳伞。
 * 墙面贴图 128×48 对应 12m 长 × 4.5m 高（下沿是海水，上面透明露出天空）。
 */

// ------------------------------------------------------------------
// 障碍
// ------------------------------------------------------------------

function drawBeachChair() {
  const a = new PixelArt(30, 16);
  for (let i = 0; i < 9; i++) {
    const col = i % 2 ? '#ffffff' : '#3cc4d9';
    a.line(3 + i * 2, 3 + i, 5 + i * 2, 3 + i, col);
  }
  a.rect(8, 10, 20, 3, '#3cc4d9');
  for (let x = 8; x < 28; x += 4) a.rect(x, 10, 2, 3, '#ffffff');
  a.line(4, 4, 8, 15, '#c98a4b');
  a.line(26, 12, 28, 15, '#c98a4b');
  a.line(12, 12, 10, 15, '#c98a4b');
  a.outline(INK);
  return a.toCanvas();
}

/** 冲浪板架（滑铲钻过）：横杆上挂着彩色冲浪板。画布 46px，板子吊在 ~1.7m 以上 */
function drawSurfRack(lanes) {
  const w = Math.round(lanes * 38.4) + 2;
  const a = new PixelArt(w, 46);
  const cols = ['#ff6f5f', '#ffd23f', '#5cc7e0', '#a77bff', '#5cc77a'];
  a.rect(1, 2, 2, 44, '#c98a4b');
  a.rect(w - 3, 2, 2, 44, '#c98a4b');
  a.rect(1, 2, w - 2, 2, '#8a5a2b');
  let i = 0;
  for (let x = 6; x < w - 6; x += 7) {
    const col = cols[i++ % cols.length];
    a.ellipse(x, 11, 2.6, 8, col);
    a.rect(x, 4, 1, 15, '#ffffff');
  }
  a.outline(INK);
  return a.toCanvas();
}

function drawReef() {
  const a = new PixelArt(36, 36);
  a.disc(12, 24, 11, '#6b6f80');
  a.disc(25, 22, 10, '#7d8294');
  a.disc(18, 13, 9, '#8f94a6');
  a.disc(15, 10, 3, '#a8adbf');
  a.disc(28, 18, 2.5, '#a8adbf');
  // 海草 + 小螃蟹
  for (const x of [5, 9, 31]) {
    for (let y = 24; y < 36; y++) a.set(x + Math.round(Math.sin(y * 0.6)), y, '#3fa35f');
  }
  a.ellipse(20, 33, 3, 2, '#ff6f5f');
  a.set(18, 31, INK);
  a.set(22, 31, INK);
  a.rect(0, 33, 36, 3, '#3fb6d8');
  a.outline(INK);
  return a.toCanvas();
}

/** 水母（2 帧触手摆动） */
function drawJelly(frame) {
  const a = new PixelArt(22, 28);
  a.ellipse(11, 8, 9, 7, '#ff9cd6');
  a.ellipse(11, 7, 7, 5, '#ffc4e8');
  a.rect(2, 9, 18, 3, '#ff9cd6');
  a.set(8, 6, '#ffffff');
  a.set(9, 5, '#ffffff');
  a.set(8, 9, INK);
  a.set(14, 9, INK);
  for (let i = 0; i < 5; i++) {
    const x = 4 + i * 3.5;
    for (let y = 12; y < 27; y++) a.set(x + Math.round(Math.sin(y * 0.5 + frame * 1.5 + i) * 1.2), y, i % 2 ? '#ff9cd6' : '#ffc4e8');
  }
  a.outline(INK);
  return a.toCanvas();
}

/** 潮水贴花（2 帧浪花） */
function drawTide(frame) {
  const a = new PixelArt(32, 18);
  a.rect(0, 0, 32, 18, '#3fa8e0');
  for (let y = 2; y < 18; y += 5) {
    for (let x = 0; x < 32; x++) if (Math.sin(x * 0.5 + y + frame * 2) > 0.5) a.set(x, y, '#9fdcff');
  }
  for (let x = 0; x < 32; x++) {
    if ((x + frame * 3) % 6 < 3) a.set(x, 0, '#ffffff');
    a.set(x, 17, '#ffffff');
  }
  return a.toCanvas();
}

// ------------------------------------------------------------------
// Boss · 蟹老板 + 弹幕
// ------------------------------------------------------------------

function drawCrab(expr) {
  const a = new PixelArt(66, 56);
  const red = '#ff5c4a';
  const dark = '#d63a2a';
  const light = '#ff9a80';
  // 腿
  for (let i = 0; i < 3; i++) {
    a.line(18, 38 + i * 3, 6, 46 + i * 3, dark);
    a.line(48, 38 + i * 3, 60, 46 + i * 3, dark);
  }
  // 大钳子
  for (const s of [-1, 1]) {
    const cx = 33 + s * 25;
    a.line(33 + s * 14, 34, cx, 24, red);
    a.line(33 + s * 14, 35, cx, 25, red);
    a.disc(cx, 18, 8, red);
    a.disc(cx - s * 2, 16, 4, light);
    a.clearRect(cx - 2, 8, 4, 6);
  }
  // 身体 / 壳
  a.ellipse(33, 36, 18, 12, red);
  a.ellipse(33, 33, 15, 8, light);
  if (expr === 'dizzy') {
    // 壳张开：露出发光的弱点
    a.ellipse(33, 30, 13, 5, '#7a2a3a');
    a.disc(33, 31, 4.5, '#ffe066');
    a.disc(33, 31, 2.5, '#ffffff');
    a.ellipse(33, 22, 16, 4, red);
  }
  // 眼柄 + 眼睛
  for (const s of [-1, 1]) {
    const ex = 33 + s * 6;
    a.rect(ex, 20, 2, 7, dark);
    a.disc(ex + 1, 18, 3.5, '#ffffff');
    if (expr === 'dizzy') {
      a.ring(ex + 1, 18, 2.4, 2.4, 1, INK);
      a.set(ex + 1, 18, INK);
    } else if (expr === 'hurt') {
      a.line(ex - 1, 16, ex + 3, 20, INK);
      a.line(ex + 3, 16, ex - 1, 20, INK);
    } else {
      a.disc(ex + 1 + s * 0.5, 18.5, 1.6, INK);
      if (expr === 'angry') a.line(ex - 2, 13, ex + 4, 15 + (s > 0 ? -2 : 0), INK);
    }
  }
  // 嘴
  if (expr === 'angry') a.rect(29, 40, 8, 2, '#7a2a3a');
  else if (expr !== 'dizzy') {
    a.set(30, 40, INK);
    a.set(31, 41, INK);
    a.set(32, 41, INK);
    a.set(33, 41, INK);
    a.set(34, 41, INK);
    a.set(35, 40, INK);
  }
  a.outline(INK);
  return a;
}

function drawBubble() {
  const a = new PixelArt(22, 22);
  a.ring(11, 11, 10, 10, 1.5, '#9fdcff');
  a.disc(11, 11, 8.6, '#d8f3ff');
  a.disc(11, 11, 7, '#c4ecff');
  a.ellipse(7, 7, 2.5, 1.5, '#ffffff');
  a.set(14, 15, '#ffffff');
  a.outline('#3d8bff');
  return a.toCanvas();
}

/** 巨钳横扫（拉伸成三道宽）：left = 左钳从左扫来 */
function drawClaw(left) {
  const w = 118;
  const h = 14;
  const a = new PixelArt(w, h);
  for (let x = 0; x < w; x++) if (x % 4 !== 3) a.set(x, h - 1, '#ff2d55');
  a.rect(0, 5, w - 24, 6, '#ff5c4a');
  a.rect(0, 5, w - 24, 2, '#ff9a80');
  a.disc(w - 18, 7, 7, '#ff5c4a');
  a.tri(w - 14, 1, w - 1, 4, w - 12, 7, '#ff5c4a');
  a.tri(w - 14, 13, w - 1, 10, w - 12, 7, '#ff5c4a');
  a.outline(INK);
  return (left ? a : a.flipped()).toCanvas();
}

function drawSpringGold() {
  const a = new PixelArt(20, 12);
  a.ellipse(10, 6, 9.5, 5.5, '#ffd23f');
  a.ellipse(10, 6, 7.5, 4, '#fff1a8');
  a.tri(6, 7, 14, 7, 10, 2, '#ff8a3c');
  a.rect(9, 7, 3, 3, '#ff8a3c');
  a.outline('#c47a00');
  return a.toCanvas();
}

// ------------------------------------------------------------------
// 墙面 / 天空 / 装饰
// ------------------------------------------------------------------

function makeBeachWall(seed, kind) {
  const W = 128;
  const H = 48;
  const a = new PixelArt(W, H);
  const rnd = seededRandom(seed);
  if (kind === 'palms') {
    for (const x of [24, 88]) {
      for (let y = 10; y < 40; y++) a.rect(x + Math.round(Math.sin(y * 0.15) * 3), y, 3, 1, y % 4 ? '#b97a40' : '#8a5a2b');
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI + (i / 5) * Math.PI;
        a.line(x + 1, 9, x + 1 + Math.cos(ang) * 14, 9 + Math.sin(ang) * 6 + 6, '#3fa35f');
        a.line(x + 1, 10, x + 1 + Math.cos(ang) * 13, 10 + Math.sin(ang) * 6 + 6, '#5cc77a');
      }
      a.disc(x + 2, 11, 1.5, '#8a5a2b');
    }
  } else if (kind === 'hut') {
    a.tri(40, 22, 88, 22, 64, 8, '#e8c46a');
    a.rect(44, 22, 40, 18, '#fff3d6');
    a.rect(58, 28, 12, 12, '#3cc4d9');
    a.rect(46, 24, 8, 6, '#9fdcff');
    a.rect(74, 24, 8, 6, '#9fdcff');
  } else if (kind === 'lighthouse') {
    a.rect(58, 4, 12, 36, '#ffffff');
    for (let y = 8; y < 40; y += 8) a.rect(58, y, 12, 4, '#ff5c4a');
    a.rect(56, 0, 16, 4, '#3b3550');
    a.rect(60, 1, 8, 3, '#ffe066');
  }
  // 海浪 + 浪花（墙的下沿 = 远处的海）
  a.rect(0, 38, W, 10, '#3fb6d8');
  for (let x = 0; x < W; x++) {
    if (Math.sin(x * 0.3 + seed) > 0.4) a.set(x, 38, '#ffffff');
    if (Math.sin(x * 0.2 + seed * 2) > 0.7) a.set(x, 42, '#9fdcff');
  }
  if (rnd() < 0.7) {
    a.rect(100, 34, 10, 4, '#ffffff');
    a.tri(104, 34, 104, 24, 112, 33, '#ff6f5f');
  }
  return a.toCanvas();
}

function makeBeachSky(palette) {
  const W = 256;
  const H = 128;
  const a = new PixelArt(W, H);
  for (let y = 0; y < H; y++) a.rect(0, y, W, 1, mixHex(palette.skyTop, palette.skyBottom, Math.min(1, (y / (H - 1)) * 1.05)));
  a.disc(60, 34, 12, '#fff6c2');
  a.disc(60, 34, 9, '#ffffff');
  const rnd = seededRandom(61);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rnd() * W);
    const y = 20 + Math.floor(rnd() * 40);
    a.ellipse(x, y, 14, 3.5, '#ffffff');
    a.disc(x + 4, y - 3, 4, '#ffffff');
  }
  // 海鸥
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rnd() * W);
    const y = 30 + Math.floor(rnd() * 30);
    a.set(x - 2, y, '#5a6a80');
    a.set(x - 1, y - 1, '#5a6a80');
    a.set(x, y, '#5a6a80');
    a.set(x + 1, y - 1, '#5a6a80');
    a.set(x + 2, y, '#5a6a80');
  }
  // 海平线
  a.rect(0, H - 14, W, 12, mixHex('#3fb6d8', palette.fog, 0.35));
  for (let x = 0; x < W; x += 5) a.set(x, H - 14, '#ffffff');
  a.rect(0, H - 2, W, 2, palette.fog);
  return a.toCanvas();
}

function drawUmbrella(color) {
  const a = new PixelArt(30, 40);
  a.rect(14, 8, 2, 32, '#e8eaf2');
  a.ellipse(15, 9, 14, 6, color);
  a.rect(1, 9, 28, 3, color);
  for (let x = 3; x < 28; x += 6) a.rect(x, 4, 3, 8, '#ffffff');
  a.clearRect(0, 12, 30, 2);
  a.outline(INK);
  return a.toCanvas();
}

/** 海边关专属素材 */
export function buildBeachSprites(level) {
  const S = SPRITES;
  S.beachChair = drawBeachChair();
  S.surfRack = [null, drawSurfRack(1), drawSurfRack(2), drawSurfRack(3)];
  S.reef = drawReef();
  S.jelly = [drawJelly(0), drawJelly(1)];
  S.tide = [drawTide(0), drawTide(1)];
  S.seaBubble = drawBubble();
  S.clawL = drawClaw(true);
  S.clawR = drawClaw(false);
  S.springGold = drawSpringGold();
  S.sandWall = drawSandWall();
  S.sandRidge = drawSandRidge();

  const arts = {};
  for (const e of ['normal', 'angry', 'dizzy', 'hurt']) arts[e] = drawCrab(e);
  registerBoss('crab', arts, [17, 10, 32, 32]);

  const walls = [makeBeachWall(3, 'palms'), makeBeachWall(7, 'hut'), makeBeachWall(11, 'palms'), makeBeachWall(15, 'lighthouse')];
  const signs = [drawUmbrella('#ff6f5f'), makeSignpost('救生员 →', '#ff5c4a'), drawUmbrella('#3cc4d9'), makeSignpost('小心涨潮', '#3d8bff'), drawUmbrella('#ffd23f')];
  S.levelAssets[level.id] = { walls, signs, sky: makeBeachSky(level.palette) };
  return S;
}

/** 沙墙（占一条道、跳不过去）：一座高高的沙丘 + 横飞的沙粒 */
function drawSandWall() {
  const a = new PixelArt(24, 54);
  const rnd = seededRandom(91);
  // 主体沙丘
  for (let y = 0; y < 52; y++) {
    const t = y / 52;
    const w = 4 + t * 7;
    for (let x = -11; x <= 11; x += 0.5) {
      if (Math.abs(x) <= w) {
        const edge = Math.abs(x) > w - 1.4;
        a.set(12 + x + Math.sin(y * 0.3) * 1.2, y, edge ? '#b98a4e' : rnd() < 0.12 ? '#efe0b8' : '#dcb273');
      }
    }
  }
  // 底部散沙
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rnd() * 24);
    const y = 48 + Math.floor(rnd() * 5);
    a.set(x, y, rnd() < 0.5 ? '#c99b60' : '#efe0b8');
  }
  // 顶部小沙雹
  for (let i = 0; i < 6; i++) a.set(6 + Math.floor(rnd() * 12), 2 + Math.floor(rnd() * 8), '#efe0b8');
  a.outline(INK);
  return a.toCanvas();
}

/** 沙墙洞里的低沙坎（stretch 拉宽，跳过去） */
function drawSandRidge() {
  const a = new PixelArt(60, 10);
  const rnd = seededRandom(93);
  for (let x = 0; x < 60; x++) {
    const h = 4 + Math.sin(x * 0.35) * 1.6 + rnd() * 1.2;
    for (let y = 9; y > 9 - h; y -= 1) a.set(x, Math.round(y), y < 9 - h + 1.4 ? '#b98a4e' : '#dcb273');
    if (rnd() < 0.2) a.set(x, Math.round(9 - h), '#efe0b8');
  }
  a.outline(INK);
  return a.toCanvas();
}
