import { PixelArt, makeCanvas, seededRandom, mixHex } from './pixel.js';
import { SPRITES, INK, registerBoss } from './sprites.js';

/**
 * 第 2 关 · 动物园 专属像素素材：障碍 / Boss 金刚 / 弹幕 / 两侧树篱墙面 / 天空 / 路边指路牌。
 * 16 像素 = 1 米；墙面贴图 128×56 对应 12m 长 × 5m 高（顶部透明 = 露出天空）。
 */
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';

// ------------------------------------------------------------------
// 障碍
// ------------------------------------------------------------------

/** 动物推车：长颈鹿花纹的小推车，车里探出一只熊猫（可以踩上去跑） */
function drawAnimalCart() {
  const a = new PixelArt(30, 24);
  const yellow = '#ffd36b';
  const spot = '#c9772f';
  const wood = '#b97a40';
  // 熊猫探头
  a.disc(11.5, 1.8, 1.9, INK);
  a.disc(18.5, 1.8, 1.9, INK);
  a.disc(15, 5, 4.6, '#ffffff');
  a.ellipse(13, 5, 1.3, 1.7, INK);
  a.ellipse(17, 5, 1.3, 1.7, INK);
  a.set(13, 4, '#ffffff');
  a.set(17, 4, '#ffffff');
  a.set(15, 7, INK);
  a.set(11, 7, '#ffb3cf');
  a.set(19, 7, '#ffb3cf');
  // 车身（长颈鹿花纹）
  a.rect(2, 9, 26, 10, yellow);
  const rnd = seededRandom(31);
  for (let i = 0; i < 9; i++) {
    const x = 4 + Math.floor(rnd() * 21);
    const y = 11 + Math.floor(rnd() * 6);
    a.rect(x, y, 2 + Math.floor(rnd() * 2), 2, spot);
  }
  a.rect(1, 7, 28, 2, wood);
  a.rect(1, 7, 28, 1, '#d9a066');
  a.rect(9, 8, 3, 2, INK); // 熊猫爪子搭在车沿
  a.rect(18, 8, 3, 2, INK);
  a.rect(2, 18, 26, 1, spot);
  // 车轮
  for (const x of [7, 23]) {
    a.disc(x, 20.5, 2.8, '#4a4a5e');
    a.set(x, 20, '#b8bfd0');
  }
  a.outline(INK);
  return a.toCanvas();
}

/** 爪印 */
function paw(a, cx, cy, c) {
  a.ellipse(cx, cy + 1, 2, 1.6, c);
  a.set(cx - 2, cy - 2, c);
  a.set(cx, cy - 3, c);
  a.set(cx + 2, cy - 2, c);
}

/** 警告三角 */
function warnTri(a, cx, top) {
  a.tri(cx - 5, top + 8, cx + 5, top + 8, cx, top - 1, INK);
  a.tri(cx - 4, top + 7, cx + 4, top + 7, cx, top + 1, '#ffd23f');
  a.rect(cx, top + 2, 1, 3, INK);
  a.set(cx, top + 6, INK);
}

/** "小心动物"横杆告示（滑铲钻过）：木牌 + 警告三角 + 爪印 */
function drawZooSign(lanes) {
  const w = Math.round(lanes * 38.4) + 2;
  const a = new PixelArt(w, 30);
  const pole = '#8a5a2b';
  a.rect(1, 1, 2, 29, pole);
  a.rect(w - 3, 1, 2, 29, pole);
  a.rect(3, 1, w - 6, 12, '#e8b56a');
  for (let y = 4; y < 13; y += 4) a.rect(3, y, w - 6, 1, '#c98a4b');
  // 黄黑警戒边
  for (let x = 3; x < w - 3; x++) if (((x >> 1) & 1) === 0) a.set(x, 1, INK);
  for (let x = 3; x < w - 3; x++) if (((x >> 1) & 1) === 0) a.set(x, 12, INK);
  const n = Math.max(1, Math.floor((w - 8) / 16));
  const step = (w - 6) / n;
  for (let i = 0; i < n; i++) {
    const cx = Math.round(3 + step * (i + 0.5));
    if (i % 2 === 0) warnTri(a, cx, 3);
    else paw(a, cx, 7, '#6b3b2a');
  }
  a.outline(INK);
  return a.toCanvas();
}

/** 孔雀花车（全高障碍） */
function drawPeacockCar() {
  const a = new PixelArt(36, 40);
  // 开屏尾羽
  a.disc(18, 16, 15.5, '#1f8f6f');
  a.disc(18, 16, 13, '#2fbf8f');
  for (let i = 0; i < 9; i++) {
    const ang = Math.PI * (1.05 + (i / 8) * 0.9);
    const x = 18 + Math.cos(ang) * 11;
    const y = 16 + Math.sin(ang) * 11;
    a.disc(x, y, 2.4, '#1d6fd1');
    a.disc(x, y, 1.2, '#ffd23f');
  }
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI * (1.15 + (i / 5) * 0.7);
    a.disc(18 + Math.cos(ang) * 6, 16 + Math.sin(ang) * 6, 1.3, '#8fe0c3');
  }
  // 身体 + 头
  a.ellipse(18, 23, 5, 7, '#2a7bd6');
  a.ellipse(17, 22, 2, 4, '#5aa0ff');
  a.disc(18, 12, 3.2, '#2a7bd6');
  a.rect(17, 14, 3, 5, '#2a7bd6');
  a.set(17, 11, '#ffffff');
  a.set(17, 12, INK);
  a.set(19, 11, '#ffffff');
  a.set(19, 12, INK);
  a.rect(18, 13, 1, 2, '#ff9a3c');
  for (let i = -1; i <= 1; i++) {
    a.set(18 + i * 2, 6, '#2a7bd6');
    a.set(18 + i * 2, 5, '#ffd23f');
  }
  a.set(17, 7, '#2a7bd6');
  a.set(19, 7, '#2a7bd6');
  a.set(18, 8, '#2a7bd6');
  // 花车底座
  a.rect(2, 30, 32, 6, '#ff6fa5');
  a.rect(2, 30, 32, 1, '#ffffff');
  for (let x = 4; x < 34; x += 5) a.rect(x, 32, 2, 2, '#ffe066');
  for (const x of [8, 28]) {
    a.disc(x, 37, 2.8, '#4a4a5e');
    a.set(x, 37, '#b8bfd0');
  }
  a.outline(INK);
  return a.toCanvas();
}

/** 企鹅纵队（横穿马路），朝右走，2 帧摇摆 */
function drawPenguins(frame) {
  const a = new PixelArt(40, 16);
  const list = [
    { x: 6, h: 14 },
    { x: 19, h: 12 },
    { x: 31, h: 10 },
  ];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const bob = (frame + i) & 1;
    const base = 15 - bob;
    const top = base - p.h + 1;
    const rx = p.h * 0.32;
    a.ellipse(p.x, top + p.h * 0.55, rx, p.h * 0.48, '#2b2a3a');
    a.ellipse(p.x + 1, top + p.h * 0.62, rx * 0.6, p.h * 0.34, '#ffffff');
    a.set(p.x + 1, top + 2, '#ffffff');
    a.set(p.x + 2, top + 2, INK);
    a.rect(p.x + Math.ceil(rx), top + 3, 2, 1, '#ff9a3c');
    a.set(p.x + 1, top + 4, '#ffb3cf');
    // 小翅膀
    a.rect(p.x - Math.floor(rx), top + Math.floor(p.h * 0.45), 1, 3, '#2b2a3a');
    // 脚（交替）
    const f = (frame + i) & 1;
    a.rect(p.x - 2 + f, 15, 2, 1, '#ff9a3c');
    a.rect(p.x + 1 - f, 15, 2, 1, '#ff9a3c');
  }
  a.outline(INK);
  return a;
}

function drawBanana() {
  const a = new PixelArt(14, 12);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = 2 + t * 10;
    const y = 3 + Math.sin(t * Math.PI) * 5;
    a.disc(x, y, 1.9, '#ffd84a');
  }
  for (let i = 2; i <= 8; i++) {
    const t = i / 10;
    a.set(2 + t * 10, 4 + Math.sin(t * Math.PI) * 5, '#f2b81f');
  }
  a.rect(1, 1, 2, 2, '#6b4a20');
  a.set(12, 3, '#6b4a20');
  a.set(5, 5, '#fff3a8');
  a.outline(INK);
  return a.toCanvas();
}

/** 路边扔香蕉的猴子（坐在木桩上） */
function drawMonkey() {
  const a = new PixelArt(24, 32);
  const fur = '#8a5a2b';
  const face = '#f2c79a';
  a.rect(6, 22, 12, 10, '#b97a40');
  a.rect(6, 22, 12, 2, '#d9a066');
  a.rect(9, 25, 1, 6, '#9a6232');
  a.ellipse(12, 17, 5, 5, fur);
  a.ellipse(12, 18, 3, 3, face);
  a.disc(12, 8, 5.5, fur);
  a.disc(6.5, 8, 2.2, face);
  a.disc(17.5, 8, 2.2, face);
  a.ellipse(12, 9, 4, 3.6, face);
  a.set(10, 8, INK);
  a.set(14, 8, INK);
  a.rect(11, 11, 3, 1, '#c2185b');
  // 举起的手臂 + 香蕉
  a.line(16, 15, 20, 7, fur);
  a.line(17, 15, 21, 7, fur);
  a.rect(19, 2, 2, 5, '#ffd84a');
  a.set(21, 2, '#ffd84a');
  a.line(7, 15, 5, 20, fur);
  // 尾巴
  a.line(17, 21, 21, 24, fur);
  a.set(21, 23, fur);
  a.outline(INK);
  return a.toCanvas();
}

/** 打滑便便（地面贴花，带一对小眼睛） */
function drawPoop() {
  const a = new PixelArt(20, 13);
  a.ellipse(10, 10, 8.5, 2.8, '#7a4a22');
  a.ellipse(10, 7.5, 6.5, 2.6, '#8f5a2b');
  a.ellipse(10, 5, 4.5, 2.2, '#a06a35');
  a.rect(10, 1, 2, 2, '#a06a35');
  a.set(11, 0, '#a06a35');
  a.set(7, 7, '#ffffff');
  a.set(8, 7, INK);
  a.set(12, 7, '#ffffff');
  a.set(13, 7, INK);
  a.set(6, 4, '#c98a4b');
  a.outline(INK);
  // 臭味线
  a.set(3, 2, '#b8d86a');
  a.set(2, 1, '#b8d86a');
  a.set(16, 2, '#b8d86a');
  a.set(17, 1, '#b8d86a');
  return a.toCanvas();
}

/** 跳板（香蕉地毯前的弹床，地面贴花） */
function drawSpringboard() {
  const a = new PixelArt(20, 12);
  a.ellipse(10, 6, 9.5, 5.5, '#ff4f6d');
  a.ellipse(10, 6, 7.5, 4, '#ffe066');
  a.tri(6, 7, 14, 7, 10, 2, '#ff4f6d');
  a.rect(9, 7, 3, 3, '#ff4f6d');
  a.outline(INK);
  return a.toCanvas();
}

/** 香蕉皮地毯（横贯三道，拉伸绘制） */
function drawBananaCarpet() {
  const w = 118;
  const h = 10;
  const a = new PixelArt(w, h);
  const rnd = seededRandom(77);
  for (let x = 0; x < w; x++) if (x % 4 !== 3) a.set(x, h - 1, '#ff2d55');
  for (let i = 0; i < 46; i++) {
    const x = 2 + Math.floor(rnd() * (w - 8));
    const y = 2 + Math.floor(rnd() * (h - 5));
    a.rect(x, y, 4, 2, '#ffd84a');
    a.set(x - 1, y + 2, '#f2b81f');
    a.set(x + 4, y + 2, '#f2b81f');
    a.set(x + 1, y, '#fff3a8');
  }
  return a.toCanvas();
}

/** 滚桶（横躺着朝主角滚来）：木纹随帧上下移动 = 滚动感 */
function drawBarrel(frame, gold) {
  const a = new PixelArt(30, 17);
  const body = gold ? '#ffd23f' : '#b97a40';
  const dark = gold ? '#e0a400' : '#8a5a2b';
  const hi = gold ? '#fff3a8' : '#d9a066';
  const hoop = gold ? '#ff9a3c' : '#4a4a5e';
  a.rect(3, 1, 24, 15, body);
  a.ellipse(3, 8.5, 2.5, 7.5, dark);
  a.ellipse(27, 8.5, 2.5, 7.5, dark);
  for (let y = 1 + frame; y < 16; y += 3) a.rect(3, y, 24, 1, dark);
  a.rect(3, 2, 24, 1, hi);
  a.rect(8, 1, 2, 15, hoop);
  a.rect(20, 1, 2, 15, hoop);
  if (gold) {
    a.set(13, 4 + frame, '#ffffff');
    a.set(16, 9 - frame, '#ffffff');
  }
  a.outline(INK);
  return a.toCanvas();
}

// ------------------------------------------------------------------
// Boss · 金刚（戴小皇冠的大猩猩，在前面边跑边往后扔东西）
// ------------------------------------------------------------------

function drawKong(expr) {
  const W = 64;
  const H = 60;
  const a = new PixelArt(W, H);
  const fur = '#4a4458';
  const furDark = '#35303f';
  const furHi = '#6a6280';
  const face = '#e2c0a6';
  const chest = '#8a7f9c';
  // 腿
  a.rect(19, 48, 10, 9, fur);
  a.rect(35, 48, 10, 9, fur);
  a.rect(17, 56, 13, 4, furDark);
  a.rect(34, 56, 13, 4, furDark);
  // 身体
  a.ellipse(32, 38, 19, 15, fur);
  a.ellipse(32, 40, 11, 10, chest);
  a.ellipse(25, 35, 3, 2, furHi);
  // 手臂 + 拳头
  a.ellipse(10, 37, 7, 13, fur);
  a.ellipse(54, 37, 7, 13, fur);
  a.ellipse(8, 33, 2, 5, furHi);
  a.disc(10, 50, 5.5, furDark);
  a.disc(54, 50, 5.5, furDark);
  // 头
  a.disc(17, 19, 3.8, fur);
  a.disc(47, 19, 3.8, fur);
  a.disc(17, 19, 1.8, face);
  a.disc(47, 19, 1.8, face);
  a.disc(32, 18, 14, fur);
  a.ellipse(32, 23, 10, 7.5, face);
  a.ellipse(26.5, 16, 5, 4, face);
  a.ellipse(37.5, 16, 5, 4, face);
  a.rect(22, 11, 20, 2, furDark); // 眉骨
  a.ellipse(24, 22, 2.5, 1.5, '#ffb3a6');
  a.ellipse(40, 22, 2.5, 1.5, '#ffb3a6');
  // 小皇冠
  a.rect(26, 2, 12, 4, '#ffd23f');
  a.set(26, 1, '#ffd23f');
  a.set(26, 0, '#ffd23f');
  a.set(31, 1, '#ffd23f');
  a.set(31, 0, '#ffd23f');
  a.set(32, 1, '#ffd23f');
  a.set(32, 0, '#ffd23f');
  a.set(37, 1, '#ffd23f');
  a.set(37, 0, '#ffd23f');
  a.set(29, 3, '#ff4f6d');
  a.set(34, 3, '#4fb3ff');
  // 眼睛
  const ey = 16;
  const ex1 = 27;
  const ex2 = 37;
  if (expr === 'dizzy') {
    for (const ex of [ex1, ex2]) {
      a.ring(ex, ey, 2.6, 2.6, 1, INK);
      a.set(ex, ey, INK);
    }
  } else if (expr === 'hurt') {
    a.line(ex1 - 2, ey - 2, ex1 + 1, ey, INK);
    a.line(ex1 + 1, ey, ex1 - 2, ey + 2, INK);
    a.line(ex2 + 2, ey - 2, ex2 - 1, ey, INK);
    a.line(ex2 - 1, ey, ex2 + 2, ey + 2, INK);
  } else {
    a.ellipse(ex1, ey, 1.6, 2.2, INK);
    a.ellipse(ex2, ey, 1.6, 2.2, INK);
    a.set(ex1 - 1, ey - 1, '#ffffff');
    a.set(ex2 - 1, ey - 1, '#ffffff');
    if (expr === 'angry') {
      a.line(ex1 - 4, ey - 5, ex1 + 2, ey - 3, INK);
      a.line(ex2 + 4, ey - 5, ex2 - 2, ey - 3, INK);
    }
  }
  // 鼻孔 + 嘴
  a.set(30, 21, INK);
  a.set(34, 21, INK);
  const my = 26;
  if (expr === 'angry') {
    a.ellipse(32, my, 5, 2.6, '#7a2a3a');
    a.rect(28, my - 2, 9, 1, '#ffffff');
  } else if (expr === 'dizzy') {
    for (let i = -4; i <= 4; i++) a.set(32 + i, my + ((i & 1) ? 1 : 0), INK);
  } else if (expr === 'hurt') {
    a.ring(32, my, 2.2, 2, 1, INK);
  } else {
    a.rect(28, my, 9, 1, INK);
    a.set(27, my - 1, INK);
    a.set(37, my - 1, INK);
  }
  a.outline(INK);
  return a;
}

// ------------------------------------------------------------------
// 墙面（树 + 树篱 + 木栅栏 + 动物）/ 天空 / 路边指路牌
// ------------------------------------------------------------------

function makeZooWall(seed, animal) {
  const W = 128;
  const H = 56;
  const a = new PixelArt(W, H);
  const rnd = seededRandom(seed);
  // 树
  const trees = 3;
  for (let i = 0; i < trees; i++) {
    const x = 18 + i * 44 + Math.floor(rnd() * 10);
    const top = 4 + Math.floor(rnd() * 10);
    a.rect(x - 2, top + 12, 5, 30, '#8a5a2b');
    a.disc(x, top + 8, 10, '#3f9f4f');
    a.disc(x - 6, top + 12, 7, '#3f9f4f');
    a.disc(x + 6, top + 12, 7, '#3f9f4f');
    a.disc(x - 2, top + 6, 6, '#5cc76a');
    a.disc(x + 3, top + 10, 4, '#5cc76a');
    a.disc(x - 4, top + 3, 2, '#8fe08f');
    if (rnd() < 0.6) {
      a.rect(x + 4, top + 5, 2, 2, '#ff6f6f');
      a.rect(x - 7, top + 11, 2, 2, '#ff6f6f');
    }
  }
  // 动物探头（在树篱后面）
  if (animal === 'giraffe') {
    const x = 64;
    a.rect(x, 12, 4, 22, '#ffd36b');
    a.rect(x + 1, 16, 2, 2, '#c9772f');
    a.rect(x, 24, 2, 2, '#c9772f');
    a.ellipse(x + 4, 10, 5, 3, '#ffd36b');
    a.set(x + 2, 9, INK);
    a.set(x + 8, 10, '#c9772f');
    a.rect(x + 1, 5, 1, 3, '#c9772f');
    a.rect(x + 4, 5, 1, 3, '#c9772f');
  } else if (animal === 'elephant') {
    const x = 60;
    a.disc(x, 30, 10, '#a3a9c0');
    a.disc(x - 9, 28, 5, '#b8bfd0');
    a.disc(x + 9, 28, 5, '#b8bfd0');
    a.rect(x - 1, 34, 3, 8, '#a3a9c0');
    a.set(x - 4, 27, INK);
    a.set(x + 4, 27, INK);
  } else if (animal === 'flamingo') {
    for (const x of [52, 74]) {
      a.rect(x, 22, 1, 14, '#ff8fb0');
      a.disc(x + 2, 20, 3, '#ff8fb0');
      a.disc(x + 1, 13, 1.6, '#ff8fb0');
      a.line(x + 1, 14, x + 2, 18, '#ff8fb0');
      a.set(x + 2, 13, '#3b1f3a');
    }
  }
  // 树篱
  for (let x = -4; x < W + 4; x += 8) {
    const r = 6 + Math.floor(rnd() * 3);
    a.disc(x + 4, 38, r, '#4fb35a');
    a.disc(x + 3, 36, r - 3, '#6cc96a');
    if (rnd() < 0.3) a.rect(x + 2, 34, 2, 2, rnd() < 0.5 ? '#ffffff' : '#ffe066');
  }
  a.rect(0, 40, W, 6, '#4fb35a');
  // 木栅栏
  a.rect(0, 44, W, 2, '#d9a066');
  a.rect(0, 50, W, 2, '#d9a066');
  for (let x = 2; x < W; x += 8) {
    a.rect(x, 42, 3, 14, '#c98a4b');
    a.set(x + 1, 41, '#c98a4b');
  }
  a.rect(0, 54, W, 2, '#7dd06c');
  return a.toCanvas();
}

function makeZooSky(palette) {
  const W = 256;
  const H = 128;
  const a = new PixelArt(W, H);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    a.rect(0, y, W, 1, mixHex(palette.skyTop, palette.skyBottom, Math.min(1, t * 1.15)));
  }
  const rnd = seededRandom(5);
  // 云朵
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rnd() * W);
    const y = 18 + Math.floor(rnd() * 50);
    for (const dx of [0, W]) {
      a.ellipse(x - dx, y, 14, 4, '#ffffff');
      a.disc(x - dx - 5, y - 3, 5, '#ffffff');
      a.disc(x - dx + 4, y - 4, 6, '#ffffff');
      a.rect(x - dx - 12, y + 3, 24, 1, '#e9f6ff');
    }
  }
  // 远山
  const hill = mixHex('#7dd06c', palette.fog, 0.55);
  for (let x = 0; x < W; x++) {
    const hgt = 10 + Math.sin((x / W) * Math.PI * 4) * 4 + Math.sin((x / W) * Math.PI * 10) * 2;
    a.rect(x, H - Math.round(hgt), 1, Math.round(hgt), hill);
  }
  a.rect(0, H - 2, W, 2, palette.fog);
  return a.toCanvas();
}

/** 路边指路牌（木桩 + 牌子，文字来自 config.memes.zooSigns） */
export function makeSignpost(text, color) {
  const tmp = makeCanvas(8, 8).getContext('2d');
  tmp.font = 'bold 9px ' + FONT;
  const tw = Math.ceil(tmp.measureText(text).width);
  const w = Math.max(30, tw + 10);
  const h = 38;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const px = Math.floor(w / 2) - 1;
  g.fillStyle = INK;
  g.fillRect(px - 1, 12, 5, h - 12);
  g.fillStyle = '#b97a40';
  g.fillRect(px, 12, 3, h - 12);
  g.fillStyle = INK;
  g.fillRect(0, 0, w, 15);
  g.fillStyle = color;
  g.fillRect(1, 1, w - 2, 13);
  g.fillStyle = '#fff8e6';
  g.fillRect(2, 2, w - 4, 11);
  g.fillStyle = color;
  g.font = 'bold 9px ' + FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 8);
  return c;
}

function drawFlowerBush() {
  const a = new PixelArt(28, 18);
  a.disc(8, 11, 7, '#3f9f4f');
  a.disc(19, 11, 8, '#3f9f4f');
  a.disc(13, 8, 7, '#5cc76a');
  a.rect(1, 12, 26, 6, '#3f9f4f');
  const rnd = seededRandom(9);
  for (let i = 0; i < 9; i++) {
    const x = 3 + Math.floor(rnd() * 22);
    const y = 4 + Math.floor(rnd() * 10);
    a.rect(x, y, 2, 2, i % 3 === 0 ? '#ffe066' : '#ff8fc0');
    a.set(x, y, '#ffffff');
  }
  a.outline(INK);
  return a.toCanvas();
}

function drawLamp() {
  const a = new PixelArt(12, 48);
  a.rect(5, 8, 2, 40, '#3b5a46');
  a.rect(3, 44, 6, 4, '#3b5a46');
  a.rect(2, 2, 8, 6, '#3b5a46');
  a.rect(3, 3, 6, 4, '#fff3a8');
  a.rect(4, 0, 4, 2, '#3b5a46');
  a.outline(INK);
  return a.toCanvas();
}

/** 动物园关专属素材 */
export function buildZooSprites(level, zooSigns) {
  const S = SPRITES;
  S.animalCart = drawAnimalCart();
  S.zooSign = [null, drawZooSign(1), drawZooSign(2), drawZooSign(3)];
  S.peacockCar = drawPeacockCar();
  const p0 = drawPenguins(0);
  const p1 = drawPenguins(1);
  S.penguinsR = [p0.toCanvas(), p1.toCanvas()];
  S.penguinsL = [p0.flipped().toCanvas(), p1.flipped().toCanvas()];
  S.banana = drawBanana();
  S.monkey = drawMonkey();
  S.poop = drawPoop();
  S.springboard = drawSpringboard();
  S.bananaCarpet = drawBananaCarpet();
  S.barrel = [drawBarrel(0, false), drawBarrel(1, false), drawBarrel(2, false)];
  S.goldBarrel = [drawBarrel(0, true), drawBarrel(1, true), drawBarrel(2, true)];
  S.pit = drawPitTile();

  const arts = {};
  for (const e of ['normal', 'angry', 'dizzy', 'hurt']) arts[e] = drawKong(e);
  registerBoss('kong', arts, [16, 2, 32, 32]);

  const walls = [makeZooWall(11, 'giraffe'), makeZooWall(23, 'none'), makeZooWall(37, 'elephant'), makeZooWall(41, 'flamingo')];
  const colors = ['#5cc77a', '#ff8a3c', '#4fb3ff', '#e0559c', '#a77bff', '#c98a4b'];
  const signs = [];
  const names = zooSigns && zooSigns.length ? zooSigns : ['动物园'];
  const bush = drawFlowerBush();
  const lamp = drawLamp();
  // 生成器左右交替摆放：指路牌 / 花丛 / 路灯 三个一组，两侧都会轮到指路牌
  for (let i = 0; i < names.length; i++) {
    signs.push(makeSignpost(names[i], colors[i % colors.length]));
    signs.push(bush);
    signs.push(lamp);
  }
  S.levelAssets[level.id] = { walls, signs, sky: makeZooSky(level.palette) };
  return S;
}

/** 跑道塌陷的坑（strip 平铺在整条被锁的道上）：黑坑 + 边缘裂纹 */
function drawPitTile() {
  const a = new PixelArt(18, 12);
  a.ellipse(9, 6, 8.2, 4.6, '#3a2b45');
  a.ellipse(9, 5.6, 6.6, 3.6, '#1c1423');
  a.ellipse(9, 5, 4.2, 2, '#0b0710');
  // 边缘裂纹
  const rnd = seededRandom(77);
  for (let i = 0; i < 5; i++) {
    const x = 2 + Math.floor(rnd() * 14);
    const y = 2 + Math.floor(rnd() * 8);
    a.set(x, y, '#5a4568');
    a.set(x + 1, y + (rnd() < 0.5 ? 0 : 1), '#4a3855');
  }
  return a.toCanvas();
}
