import { PixelArt, makeCanvas, seededRandom, mixHex } from './pixel.js';
import { SPRITES, INK, registerBoss, drawBun } from './sprites.js';

/**
 * 第 3 关 · 香港街头 专属像素素材：障碍 / Boss 波哥 / 弹幕 / 两侧唐楼墙面 / 夜空 / 竖排霓虹招牌。
 * 16 像素 = 1 米；墙面贴图 128×160 对应 12m 长 × 16m 高（楼顶以上透明 = 露出夜空）。
 */
const FONT = '"PingFang HK","PingFang SC","Microsoft JhengHei","Microsoft YaHei","Noto Sans SC",sans-serif';
const NEON = ['#ff3d8b', '#3df2ff', '#ffd23f', '#a46bff', '#5cff9d', '#ff8a3c'];

// ------------------------------------------------------------------
// 障碍
// ------------------------------------------------------------------

/** 双层巴士站（候车亭 + 红色 BUS 牌） */
function drawBusStop() {
  const a = new PixelArt(36, 44);
  a.rect(0, 4, 36, 3, '#c42a3a');
  a.rect(0, 4, 36, 1, '#ff6f7f');
  a.rect(2, 7, 2, 37, '#8f9bb3');
  a.rect(32, 7, 2, 37, '#8f9bb3');
  a.rect(4, 7, 28, 28, '#5a8fb8');
  a.rect(5, 8, 26, 26, '#8fc8ec');
  // 广告海报：粉色爱心
  a.rect(8, 10, 12, 18, '#ffffff');
  a.rect(9, 11, 10, 16, '#ff8cba');
  a.disc(12, 16, 2.2, '#ffffff');
  a.disc(16, 16, 2.2, '#ffffff');
  a.tri(10, 17, 18, 17, 14, 22, '#ffffff');
  // 线路表
  a.rect(22, 10, 7, 18, '#f2f0ff');
  for (let y = 12; y < 27; y += 3) a.rect(23, y, 5, 1, '#5a5a7a');
  // 长凳
  a.rect(6, 35, 24, 2, '#b97a40');
  a.rect(8, 37, 2, 7, '#4a4a5e');
  a.rect(26, 37, 2, 7, '#4a4a5e');
  // BUS 牌
  a.rect(10, 0, 16, 5, '#e8343f');
  a.text('BUS', 12, 0, '#ffffff');
  a.outline(INK);
  return a.toCanvas();
}

/** 报刊亭（S 型双连） */
function drawNewsstand() {
  const a = new PixelArt(36, 40);
  const green = '#2f8f5b';
  a.rect(1, 0, 34, 7, '#246f47');
  a.rect(3, 1, 30, 5, '#ffd23f');
  a.text('NEWS', 10, 1, '#246f47');
  for (let x = 0; x < 36; x += 4) {
    a.rect(x, 7, 2, 3, '#ffffff');
    a.rect(x + 2, 7, 2, 3, green);
  }
  a.rect(2, 10, 32, 30, green);
  const rnd = seededRandom(19);
  const mags = ['#ff6fa5', '#ffd23f', '#4fb3ff', '#ff8a3c', '#a77bff', '#ffffff', '#5cc77a'];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 5; i++) {
      const x = 4 + i * 6;
      const y = 11 + row * 8;
      a.rect(x, y, 5, 7, mags[Math.floor(rnd() * mags.length)]);
      a.rect(x + 1, y + 1, 3, 1, '#3b1f3a');
      a.set(x + 1, y + 4, '#ffffff');
    }
  }
  a.rect(2, 35, 32, 5, '#246f47');
  a.rect(4, 36, 10, 3, '#f2f0ff');
  a.rect(18, 36, 12, 3, '#f2f0ff');
  a.outline(INK);
  return a.toCanvas();
}

/** 人力车（背面视角，慢慢往前走；可以踩上去） */
function drawRickshaw() {
  const a = new PixelArt(34, 28);
  // 车夫的草帽
  a.tri(10, 5, 24, 5, 17, 0, '#e8c46a');
  a.rect(11, 5, 12, 1, '#c9a04a');
  // 座椅靠背
  a.rect(6, 8, 22, 12, '#c8302f');
  a.rect(6, 8, 22, 2, '#ff6f5f');
  a.rect(8, 11, 8, 7, '#a82525');
  a.rect(18, 11, 8, 7, '#a82525');
  a.rect(5, 19, 24, 2, '#3b2a22');
  // 车轮
  for (const x of [5, 29]) {
    a.disc(x, 21, 6.5, '#3b2a22');
    a.disc(x, 21, 5, '#e8c46a');
    a.disc(x, 21, 4, '#3b2a22');
    a.line(x - 4, 21, x + 4, 21, '#e8c46a');
    a.line(x, 17, x, 25, '#e8c46a');
  }
  a.rect(14, 21, 6, 5, '#3b2a22');
  a.outline(INK);
  return a.toCanvas();
}

/** 坠落的霓虹招牌 */
function drawNeonFall() {
  const a = new PixelArt(28, 16);
  a.rect(0, 0, 28, 16, '#1a1030');
  a.rect(1, 1, 26, 1, '#ff3d8b');
  a.rect(1, 14, 26, 1, '#ff3d8b');
  a.rect(1, 1, 1, 14, '#ff3d8b');
  a.rect(26, 1, 1, 14, '#ff3d8b');
  a.text('HOT', 5, 5, '#3df2ff');
  a.disc(23, 8, 1.6, '#ffd23f');
  a.outline(INK);
  return a.toCanvas();
}

/** 港铁闸机（左右两道同时出现，只留中间） */
function drawGate() {
  const a = new PixelArt(30, 36);
  a.rect(2, 8, 2, 28, '#8f9bb3');
  a.rect(26, 8, 2, 28, '#8f9bb3');
  a.rect(0, 0, 30, 9, '#e8343f');
  a.rect(1, 1, 28, 7, '#ff4f5f');
  a.text('MTR', 9, 2, '#ffffff');
  a.rect(5, 20, 20, 16, '#b8bfd0');
  a.rect(5, 20, 20, 2, '#e6eaf2');
  a.rect(8, 23, 6, 4, '#2b2a3a');
  a.line(9, 24, 12, 26, '#ff2d55');
  a.line(12, 24, 9, 26, '#ff2d55');
  // 红色挡板
  a.rect(16, 25, 9, 3, '#ff2d55');
  a.rect(16, 25, 9, 1, '#ff8fa6');
  a.rect(7, 30, 16, 1, '#8f9bb3');
  a.outline(INK);
  return a.toCanvas();
}

/** 巨型丝袜奶茶（波哥的直线弹幕） */
function drawMilkTea() {
  const a = new PixelArt(28, 36);
  // 吸管
  a.rect(17, 0, 2, 9, '#ff6fa5');
  a.rect(17, 0, 1, 9, '#ffb3cf');
  // 杯盖
  a.ellipse(14, 9, 11, 2.5, '#f2f0ff');
  a.rect(3, 9, 22, 2, '#dfe5f0');
  for (let y = 11; y < 35; y++) {
    const inset = Math.floor((y - 11) / 8);
    const t = (y - 11) / 24;
    a.rect(4 + inset, y, 20 - inset * 2, 1, mixHex('#e0b07a', '#a0612f', t));
  }
  a.rect(5, 15, 2, 14, '#f5d6ae');
  // 杯身贴纸：小爱心
  a.rect(9, 19, 10, 8, '#ffffff');
  a.set(12, 21, '#ff3d7f');
  a.set(15, 21, '#ff3d7f');
  a.rect(12, 22, 4, 1, '#ff3d7f');
  a.rect(13, 23, 2, 1, '#ff3d7f');
  a.outline(INK);
  return a.toCanvas();
}

/** 镬铲地波（横贯三道的火焰，要跳过） */
function drawWokWave(frame) {
  const w = 118;
  const h = 12;
  const a = new PixelArt(w, h);
  for (let x = 0; x < w; x++) if (x % 4 !== 3) a.set(x, h - 1, '#ff2d55');
  for (let x = 0; x < w; x++) {
    const hh = 5 + Math.round(3 * Math.abs(Math.sin(x * 0.35 + frame * 1.7)) + 2 * Math.sin(x * 0.11 - frame));
    for (let y = h - 1 - hh; y < h - 1; y++) {
      const t = (y - (h - 1 - hh)) / Math.max(1, hh);
      a.set(x, y, t < 0.3 ? '#ffe066' : t < 0.65 ? '#ff9a3c' : '#ff4f2d');
    }
  }
  return a.toCanvas();
}

// ------------------------------------------------------------------
// Boss · 波哥（茶餐厅老板，举着镬铲）
// ------------------------------------------------------------------

function drawBo(expr) {
  const W = 60;
  const H = 64;
  const a = new PixelArt(W, H);
  const skin = '#ffcfa8';
  const hair = '#2b2230';
  const apron = '#3fae7a';
  const apronDark = '#2f8a5f';
  // 腿 + 拖鞋
  a.rect(20, 54, 8, 7, '#3b3550');
  a.rect(32, 54, 8, 7, '#3b3550');
  a.rect(18, 61, 11, 3, '#ff6fa5');
  a.rect(31, 61, 11, 3, '#ff6fa5');
  // 身体（白背心 + 绿围裙）
  a.ellipse(30, 44, 17, 13, '#ffffff');
  a.rect(19, 38, 22, 18, apron);
  a.rect(19, 38, 22, 2, apronDark);
  a.rect(25, 45, 10, 6, apronDark);
  a.set(29, 47, '#ff6fa5');
  a.set(31, 47, '#ff6fa5');
  a.rect(29, 48, 3, 1, '#ff6fa5');
  a.set(30, 49, '#ff6fa5');
  // 左手托着一杯奶茶
  a.ellipse(10, 43, 5, 9, skin);
  a.rect(4, 32, 9, 8, '#ffffff');
  a.rect(5, 33, 7, 3, '#c98a4b');
  a.rect(3, 39, 11, 2, '#dfe5f0');
  // 右手高举镬铲
  a.rect(46, 20, 6, 22, skin);
  a.disc(49, 19, 3.6, skin);
  a.rect(48, 4, 3, 15, '#8a5a2b');
  a.rect(43, 0, 13, 6, '#c3c9d8');
  a.rect(43, 0, 13, 1, '#eef1f7');
  // 头
  a.disc(17, 22, 2.8, skin);
  a.disc(43, 22, 2.8, skin);
  a.disc(30, 21, 13, skin);
  // 飞机头
  a.ellipse(30, 9, 13, 5, hair);
  a.ellipse(26, 6, 8, 4, hair);
  a.set(22, 5, '#4c3d52');
  a.set(23, 4, '#4c3d52');
  a.rect(17, 10, 3, 8, hair);
  a.rect(40, 10, 3, 8, hair);
  // 腮红
  a.ellipse(21, 26, 2.5, 1.5, '#ff9cb8');
  a.ellipse(39, 26, 2.5, 1.5, '#ff9cb8');
  // 眼睛
  const ey = 20;
  const ex1 = 25;
  const ex2 = 35;
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
    a.ellipse(ex1, ey, 1.5, 2, INK);
    a.ellipse(ex2, ey, 1.5, 2, INK);
    a.set(ex1 - 1, ey - 1, '#ffffff');
    a.set(ex2 - 1, ey - 1, '#ffffff');
    if (expr === 'angry') {
      a.line(ex1 - 4, ey - 5, ex1 + 2, ey - 3, INK);
      a.line(ex2 + 4, ey - 5, ex2 - 2, ey - 3, INK);
    } else {
      a.line(ex1 - 3, ey - 4, ex1 + 2, ey - 4, INK);
      a.line(ex2 - 2, ey - 4, ex2 + 3, ey - 4, INK);
    }
  }
  // 八字胡 + 嘴
  a.rect(25, 26, 11, 2, hair);
  a.set(24, 28, hair);
  a.set(36, 28, hair);
  const my = 30;
  if (expr === 'angry') {
    a.ellipse(30, my + 1, 3.5, 2, '#c2185b');
    a.rect(28, my, 5, 1, '#ffffff');
  } else if (expr === 'dizzy') {
    for (let i = -3; i <= 3; i++) a.set(30 + i, my + ((i & 1) ? 1 : 0), INK);
  } else if (expr === 'hurt') {
    a.ring(30, my + 1, 2, 2, 1, INK);
  } else {
    a.rect(28, my, 5, 1, INK);
    a.set(27, my - 1, INK);
    a.set(33, my - 1, INK);
  }
  a.outline(INK);
  return a;
}

// ------------------------------------------------------------------
// 墙面（唐楼 + 霓虹 + 地铺）/ 夜空 / 竖排霓虹招牌
// ------------------------------------------------------------------

function makeHkWall(seed, names) {
  const W = 128;
  const H = 160;
  const a = new PixelArt(W, H);
  const rnd = seededRandom(seed);
  const facades = ['#3a3358', '#45305a', '#2f3d5c', '#4a3a4f', '#383a66'];
  const signs = [];
  for (let b = 0; b < 2; b++) {
    const x0 = b * 64;
    const top = 8 + Math.floor(rnd() * 34);
    const col = facades[Math.floor(rnd() * facades.length)];
    a.rect(x0, top, 64, H - top, col);
    a.rect(x0, top, 64, 2, mixHex(col, '#ffffff', 0.25));
    // 楼顶的水塔 / 天线
    if (rnd() < 0.6) {
      a.rect(x0 + 40, top - 6, 10, 6, '#5a5470');
      a.rect(x0 + 44, top - 10, 1, 4, '#8f9bb3');
    }
    // 窗户 + 冷气机
    for (let y = top + 6; y < 112; y += 10) {
      for (let x = x0 + 5; x < x0 + 60; x += 9) {
        const lit = rnd();
        a.rect(x, y, 6, 6, lit < 0.45 ? '#ffd27a' : lit < 0.6 ? '#9fe3ff' : '#1e1a33');
        a.rect(x, y + 6, 6, 1, mixHex(col, '#000000', 0.3));
        if (rnd() < 0.25) a.rect(x + 1, y + 7, 4, 2, '#b8bfd0');
      }
    }
    // 墙上的横向霓虹招牌
    const sy = 70 + Math.floor(rnd() * 26);
    const neon = NEON[Math.floor(rnd() * NEON.length)];
    a.rect(x0 + 6, sy, 52, 16, '#1a1030');
    a.rect(x0 + 6, sy, 52, 1, neon);
    a.rect(x0 + 6, sy + 15, 52, 1, neon);
    a.rect(x0 + 6, sy, 1, 16, neon);
    a.rect(x0 + 57, sy, 1, 16, neon);
    signs.push({ x: x0 + 32, y: sy + 8, color: neon, text: names[Math.floor(rnd() * names.length)] });
  }
  // 地铺：招牌带 + 亮灯铺面 / 卷闸
  a.rect(0, 116, W, 12, '#1a1030');
  for (let b = 0; b < 2; b++) {
    const x0 = b * 64;
    const neon = NEON[(seed + b * 3) % NEON.length];
    a.rect(x0 + 2, 117, 60, 1, neon);
    a.rect(x0 + 2, 126, 60, 1, neon);
    signs.push({ x: x0 + 32, y: 122, color: neon, text: names[(seed + b) % names.length], small: true });
    if (rnd() < 0.7) {
      a.rect(x0 + 2, 128, 60, 32, '#ffe9b0');
      for (let x = x0 + 4; x < x0 + 62; x += 12) a.rect(x, 128, 2, 32, '#c98a4b');
      a.rect(x0 + 2, 128, 60, 3, '#ff8a3c');
    } else {
      a.rect(x0 + 2, 128, 60, 32, '#8f9bb3');
      for (let y = 129; y < 160; y += 2) a.rect(x0 + 2, y, 60, 1, '#6a7590');
    }
  }
  a.rect(0, 156, W, 4, '#2b2440');
  const c = a.toCanvas();
  // 中文招牌字（画在不透明的招牌底上）
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const s of signs) {
    g.font = 'bold ' + (s.small ? 8 : 11) + 'px ' + FONT;
    g.fillStyle = s.color;
    g.fillText(s.text, s.x, s.y + 0.5);
  }
  return c;
}

function makeHkSky(palette) {
  const W = 256;
  const H = 128;
  const a = new PixelArt(W, H);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    a.rect(0, y, W, 1, mixHex(palette.skyTop, palette.skyBottom, t * t));
  }
  const rnd = seededRandom(17);
  // 星星（避开第 0 行：天空贴图顶行会被向上拉伸，那里有星星就会变成一条竖线）
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rnd() * W);
    const y = 3 + Math.floor(rnd() * 67);
    a.set(x, y, rnd() < 0.3 ? '#ffffff' : '#b9b4e8');
  }
  // 月亮
  a.disc(200, 22, 8, '#fff6d6');
  a.disc(204, 19, 7, mixHex(palette.skyTop, palette.skyBottom, 0.05));
  // 远处的天际线（带零星灯光）
  const far = mixHex('#1a1030', palette.fog, 0.35);
  let x = 0;
  while (x < W) {
    const bw = 8 + Math.floor(rnd() * 14);
    const bh = 14 + Math.floor(rnd() * 34);
    a.rect(x, H - bh, bw, bh, far);
    for (let yy = H - bh + 3; yy < H - 4; yy += 4) {
      for (let xx = x + 2; xx < x + bw - 1; xx += 3) if (rnd() < 0.25) a.set(xx, yy, rnd() < 0.5 ? '#ffd27a' : '#ff8fc0');
    }
    x += bw;
  }
  a.rect(0, H - 2, W, 2, palette.fog);
  return a.toCanvas();
}

/** 竖排霓虹招牌（悬挂在两侧，文字来自 config.memes.hkSigns） */
function makeNeonSign(text, color) {
  const chars = Array.from(text);
  const w = 18;
  const h = chars.length * 13 + 8;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = INK;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a1030';
  g.fillRect(1, 1, w - 2, h - 2);
  g.fillStyle = color;
  g.fillRect(2, 2, w - 4, 1);
  g.fillRect(2, h - 3, w - 4, 1);
  g.fillRect(2, 2, 1, h - 4);
  g.fillRect(w - 3, 2, 1, h - 4);
  g.font = 'bold 11px ' + FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < chars.length; i++) {
    g.globalAlpha = 0.35;
    g.fillStyle = '#ffffff';
    g.fillText(chars[i], w / 2 + 0.5, 10.5 + i * 13);
    g.globalAlpha = 1;
    g.fillStyle = color;
    g.fillText(chars[i], w / 2, 10 + i * 13);
  }
  return c;
}

/** 香港关专属素材 */
export function buildHkSprites(level, hkSigns) {
  const S = SPRITES;
  S.busStop = drawBusStop();
  S.newsstand = drawNewsstand();
  S.rickshaw = drawRickshaw();
  S.neonFall = drawNeonFall();
  S.gate = drawGate();
  S.milkTea = drawMilkTea();
  S.wokWave = [drawWokWave(0), drawWokWave(1), drawWokWave(2)];
  S.bunLob = drawBun(false);
  S.bunGlow = drawBun(true);
  S.trayLow = drawTrayBand('low');
  S.trayHigh = drawTrayBand('high');

  const arts = {};
  for (const e of ['normal', 'angry', 'dizzy', 'hurt']) arts[e] = drawBo(e);
  registerBoss('bo', arts, [15, 4, 30, 30]);

  const names = hkSigns && hkSigns.length ? hkSigns : ['香港'];
  const walls = [makeHkWall(3, names), makeHkWall(8, names), makeHkWall(13, names), makeHkWall(21, names)];
  const signs = [];
  for (let i = 0; i < names.length; i++) signs.push(makeNeonSign(names[i], NEON[i % NEON.length]));
  S.levelAssets[level.id] = { walls, signs, sky: makeHkSky(level.palette) };
  return S;
}

/** 一摞餐盘（餐盘节奏链的单元）：白瓷盘 + 菠萝油 + 银盖 */
function drawPlateStack() {
  const a = new PixelArt(14, 12);
  a.ellipse(7, 9.5, 6.2, 2.2, '#ffffff');
  a.ellipse(7, 9.2, 4.6, 1.5, '#e8edf5');
  a.ellipse(7, 7.2, 5.6, 1.8, '#ffffff');
  a.ellipse(7, 7, 4, 1.2, '#e8edf5');
  a.ellipse(7, 5.4, 3.4, 1.4, '#ffd9a0');
  a.rect(6, 3.4, 3, 1.6, '#ffd23f');
  a.ellipse(7, 3, 4.6, 1.2, '#c9d4e2');
  a.set(2, 9, '#c9d4e2');
  a.set(12, 9, '#c9d4e2');
  a.outline(INK);
  return a;
}

/** 餐盘节奏链的横带：low = 低空一排餐盘（跳）/ high = 吊着的一排餐盘（滑铲） */
function drawTrayBand(kind) {
  const w = 118;
  const h = kind === 'low' ? 14 : 26;
  const a = new PixelArt(w, h);
  const rnd = seededRandom(kind === 'low' ? 41 : 43);
  const plate = drawPlateStack();
  const pw = 14;
  const ph = 12;
  const yBase = kind === 'low' ? h - 6 : 4;
  for (let x = -3; x < w - 6; x += 11) {
    const ox = x + Math.floor(rnd() * 3);
    const oy = yBase + Math.floor(rnd() * 2);
    if (kind === 'high') {
      // 吊绳
      for (let y = 0; y < oy; y++) a.set(ox + 7, y, '#8a7a90');
      a.set(ox + 6, Math.max(0, oy - 2), '#8a7a90');
      a.set(ox + 8, Math.max(0, oy - 2), '#8a7a90');
    }
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
      const c = plate.buf[j * pw + i];
      if (c) a.set(ox + i, oy + j, c);
    }
  }
  a.outline(INK);
  return a.toCanvas();
}
