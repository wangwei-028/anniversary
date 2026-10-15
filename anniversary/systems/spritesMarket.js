import { PixelArt, makeCanvas, seededRandom, mixHex } from './pixel.js';
import { SPRITES, INK, registerBoss } from './sprites.js';

/**
 * 第 5 关 · 夜市 专属像素素材：障碍 / Boss 章章 / 弹幕 / 两侧摊位墙面 / 夜空 / 灯笼招牌。
 * 墙面贴图 128×80 对应 12m 长 × 7m 高。
 */
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';
const WARM = ['#ff4f4f', '#ffb347', '#ffd23f', '#ff7a5c', '#f5b82e'];

// ------------------------------------------------------------------
// 障碍
// ------------------------------------------------------------------

/** 小吃摊车：红白遮阳棚 + 冒热气的锅 */
function drawSnackCart() {
  const a = new PixelArt(36, 40);
  for (let x = 0; x < 36; x += 6) {
    a.rect(x, 4, 3, 6, '#ff4f4f');
    a.rect(x + 3, 4, 3, 6, '#ffffff');
  }
  for (let x = 0; x < 36; x += 3) a.set(x + 1, 10, x % 6 ? '#ffffff' : '#ff4f4f');
  a.rect(2, 10, 2, 14, '#8a5a2b');
  a.rect(32, 10, 2, 14, '#8a5a2b');
  // 灯笼
  a.ellipse(8, 14, 2.5, 3, '#ff3d3d');
  a.set(8, 11, '#ffd23f');
  a.ellipse(28, 14, 2.5, 3, '#ff3d3d');
  a.set(28, 11, '#ffd23f');
  // 柜台 + 锅
  a.rect(1, 24, 34, 12, '#c98a4b');
  a.rect(1, 24, 34, 2, '#e8b56a');
  a.ellipse(18, 22, 8, 3, '#4a4a5e');
  a.ellipse(18, 21, 6, 1.5, '#ffb347');
  a.set(15, 17, '#ffffff');
  a.set(16, 15, '#ffffff');
  a.set(20, 16, '#ffffff');
  a.set(21, 14, '#ffffff');
  // 车轮
  a.disc(8, 37, 3, '#3b3550');
  a.disc(28, 37, 3, '#3b3550');
  a.outline(INK);
  // 顶棚中文招牌（"小吃"）画在 canvas 上
  const c = a.toCanvas();
  const g = c.getContext('2d');
  g.fillStyle = '#ffd23f';
  g.fillRect(9, 0, 18, 5);
  g.fillStyle = '#ff3d3d';
  g.font = 'bold 5px ' + FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('小吃', 18, 2.8);
  return c;
}

/** 红色塑料凳一排 */
function drawStools() {
  const a = new PixelArt(32, 12);
  for (const x of [2, 13, 24]) {
    a.ellipse(x + 3, 2, 3.5, 1.5, '#ff4f4f');
    a.rect(x, 2, 7, 2, '#e03030');
    a.line(x, 4, x - 1, 11, '#e03030');
    a.line(x + 6, 4, x + 7, 11, '#e03030');
    a.rect(x + 1, 7, 5, 1, '#e03030');
  }
  a.outline(INK);
  return a.toCanvas();
}

/** 灯笼串（滑铲钻过） */
function drawLanterns(lanes) {
  const w = Math.round(lanes * 38.4) + 2;
  const a = new PixelArt(w, 32);
  a.rect(1, 0, 2, 32, '#5a4636');
  a.rect(w - 3, 0, 2, 32, '#5a4636');
  for (let x = 3; x < w - 3; x++) a.set(x, 2 + Math.round(Math.sin((x / (w - 6)) * Math.PI) * 2), '#3b2a22');
  for (let x = 9; x < w - 6; x += 10) {
    const y = 3 + Math.round(Math.sin(((x - 3) / (w - 6)) * Math.PI) * 2);
    a.ellipse(x, y + 6, 3.5, 4.5, '#ff3d3d');
    a.rect(x - 2, y + 1, 5, 1, '#ffd23f');
    a.rect(x - 2, y + 11, 5, 1, '#ffd23f');
    a.set(x, y + 12, '#ffd23f');
    a.set(x, y + 13, '#ffd23f');
    a.set(x - 1, y + 5, '#ffb3a6');
  }
  a.outline(INK);
  return a.toCanvas();
}

function drawSkewer() {
  const a = new PixelArt(18, 10);
  a.line(1, 8, 16, 1, '#e8c46a');
  for (let i = 0; i < 3; i++) {
    const x = 5 + i * 4;
    const y = 6 - i * 2;
    a.disc(x, y, 2, i === 1 ? '#c94a2a' : '#a0612f');
    a.set(x - 1, y - 1, '#ffd27a');
  }
  a.outline(INK);
  return a.toCanvas();
}

/** 人潮（朝右走，2 帧） */
function drawCrowd(frame) {
  const a = new PixelArt(38, 32);
  const people = [
    { x: 5, shirt: '#4fb3ff', hair: '#2b2230', h: 30 },
    { x: 17, shirt: '#ff8a3c', hair: '#6b3b2a', h: 28 },
    { x: 29, shirt: '#a77bff', hair: '#3b2a22', h: 31 },
  ];
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const top = 32 - p.h;
    const lift = (frame + i) & 1;
    a.rect(p.x - 2, top + 18, 2, 12 - lift, '#3b3550');
    a.rect(p.x + 1, top + 18, 2, 12 - (1 - lift), '#3b3550');
    a.rect(p.x - 3, top + 8, 7, 11, p.shirt);
    a.disc(p.x, top + 4, 3.4, '#ffd9bf');
    a.rect(p.x - 3, top, 7, 3, p.hair);
    a.set(p.x + 2, top + 4, INK);
    // 手里的小吃
    a.rect(p.x + 4, top + 11, 2, 3, i === 1 ? '#ffd23f' : '#ff6fa5');
  }
  a.outline(INK);
  return a;
}

/** 冲出来的小贩（朝右跑，2 帧） */
function drawHawker(frame) {
  const a = new PixelArt(22, 32);
  const lift = frame & 1;
  a.rect(8, 20, 2, 11 - lift, '#3b3550');
  a.rect(12, 20, 2, 11 - (1 - lift), '#3b3550');
  a.rect(7, 9, 8, 12, '#ffffff');
  a.rect(7, 16, 8, 5, '#ff4f4f');
  a.disc(11, 5, 3.6, '#ffd9bf');
  a.rect(7, 0, 8, 3, '#ffffff');
  a.rect(8, 2, 6, 1, '#ff4f4f');
  a.set(13, 5, INK);
  // 托盘
  a.rect(14, 10, 8, 2, '#c98a4b');
  a.disc(16, 8, 1.5, '#ffb347');
  a.disc(19, 8, 1.5, '#ff6f5f');
  a.outline(INK);
  return a;
}

/** 喇叭叫卖气泡 */
function drawShoutBubble() {
  const c = makeCanvas(40, 22);
  const g = c.getContext('2d');
  g.fillStyle = INK;
  g.fillRect(0, 0, 40, 17);
  g.fillStyle = '#fff6c2';
  g.fillRect(1, 1, 38, 15);
  g.fillStyle = INK;
  g.fillRect(16, 17, 6, 2);
  g.fillRect(18, 19, 3, 2);
  g.fillStyle = '#fff6c2';
  g.fillRect(17, 16, 4, 2);
  g.fillStyle = '#ff3d3d';
  g.font = 'bold 9px ' + FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('来喽!', 20, 9);
  return c;
}

// ------------------------------------------------------------------
// Boss · 章章（八手翻章鱼烧的老板）+ 弹幕
// ------------------------------------------------------------------

function drawZhang(expr) {
  const W = 64;
  const H = 60;
  const a = new PixelArt(W, H);
  const red = '#ff6f6f';
  const dark = '#e04848';
  const light = '#ffb3a6';
  // 8 条触手（左右各 4，手里拿签子 / 章鱼烧）
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const bx = 32 + s * (10 + i * 2);
      const by = 34 + i * 3;
      const ex = 32 + s * (22 + i * 2);
      const ey = 26 + i * 8;
      a.line(bx, by, ex, ey, red);
      a.line(bx, by + 1, ex, ey + 1, red);
      a.line(bx, by + 2, ex, ey + 2, dark);
      a.disc(ex + s, ey, 2.2, '#c98a4b');
      a.set(ex + s, ey - 1, '#fff6c2');
    }
  }
  // 头（大圆）
  a.ellipse(32, 28, 16, 17, red);
  a.ellipse(32, 30, 14, 14, red);
  a.ellipse(26, 18, 4, 3, light);
  // 头巾（钵卷）
  a.rect(16, 14, 32, 4, '#ffffff');
  a.rect(16, 15, 32, 1, '#ff3d3d');
  a.rect(44, 12, 6, 3, '#ffffff');
  a.rect(46, 15, 4, 4, '#ffffff');
  // 吸盘点
  for (let i = 0; i < 4; i++) a.set(20 + i * 8, 40, light);
  // 眼睛
  const ey = 26;
  const ex1 = 26;
  const ex2 = 38;
  if (expr === 'dizzy') {
    for (const ex of [ex1, ex2]) {
      a.ring(ex, ey, 2.8, 2.8, 1, INK);
      a.set(ex, ey, INK);
    }
  } else if (expr === 'hurt') {
    a.line(ex1 - 2, ey - 2, ex1 + 1, ey, INK);
    a.line(ex1 + 1, ey, ex1 - 2, ey + 2, INK);
    a.line(ex2 + 2, ey - 2, ex2 - 1, ey, INK);
    a.line(ex2 - 1, ey, ex2 + 2, ey + 2, INK);
  } else {
    a.disc(ex1, ey, 3, '#ffffff');
    a.disc(ex2, ey, 3, '#ffffff');
    a.disc(ex1 + 1, ey, 1.5, INK);
    a.disc(ex2 - 1, ey, 1.5, INK);
    if (expr === 'angry') {
      a.line(ex1 - 3, ey - 5, ex1 + 3, ey - 3, INK);
      a.line(ex2 + 3, ey - 5, ex2 - 3, ey - 3, INK);
    }
  }
  // 嘟嘟嘴
  const my = 34;
  if (expr === 'angry') a.ellipse(32, my, 3, 2, '#7a2a3a');
  else if (expr === 'dizzy') for (let i = -3; i <= 3; i++) a.set(32 + i, my + ((i & 1) ? 1 : 0), INK);
  else a.ring(32, my, 2.5, 2, 1, dark);
  a.ellipse(22, 31, 2.5, 1.5, '#ff9cb8');
  a.ellipse(42, 31, 2.5, 1.5, '#ff9cb8');
  // 章鱼烧铁板
  a.rect(14, 50, 36, 6, '#4a4a5e');
  for (let x = 17; x < 48; x += 5) a.disc(x, 52, 1.8, '#c98a4b');
  a.rect(14, 56, 36, 2, '#2b2a3a');
  a.outline(INK);
  return a;
}

function drawTakoBall(glow, size) {
  const n = size;
  const a = new PixelArt(n, n);
  const r = n / 2 - 1;
  a.disc(n / 2, n / 2, r, glow ? '#ffd23f' : '#b5651d');
  a.disc(n / 2 - r * 0.2, n / 2 - r * 0.2, r * 0.75, glow ? '#fff1a8' : '#d9893a');
  // 酱汁 + 美乃滋 + 海苔
  for (let i = -1; i <= 1; i++) a.line(n / 2 - r * 0.6, n / 2 + i * r * 0.35, n / 2 + r * 0.6, n / 2 + i * r * 0.35 - 1, glow ? '#ff8a3c' : '#5a2a10');
  a.line(n / 2 - r * 0.5, n / 2 - r * 0.5, n / 2 + r * 0.5, n / 2 + r * 0.4, '#fff6e6');
  a.set(n / 2 + 1, n / 2 - r * 0.6, '#5cc77a');
  a.set(n / 2 - 2, n / 2 + r * 0.3, '#5cc77a');
  a.outline(INK);
  return a.toCanvas();
}

/** 木鱼敲击波（拉伸成三道宽，2 帧） */
function drawBeatWave(frame) {
  const w = 118;
  const h = 12;
  const a = new PixelArt(w, h);
  for (let x = 0; x < w; x++) if (x % 4 !== 3) a.set(x, h - 1, '#ff2d55');
  for (let x = 0; x < w; x++) {
    const hh = 4 + Math.round(3 * Math.abs(Math.sin(x * 0.2 + frame * 1.6)));
    for (let y = h - 1 - hh; y < h - 1; y++) a.set(x, y, y < h - 1 - hh + 2 ? '#fff1a8' : '#c98a4b');
  }
  return a.toCanvas();
}

// ------------------------------------------------------------------
// 墙面 / 夜空 / 灯笼招牌
// ------------------------------------------------------------------

function makeMarketWall(seed, names) {
  const W = 128;
  const H = 80;
  const a = new PixelArt(W, H);
  const rnd = seededRandom(seed);
  const signs = [];
  for (let s = 0; s < 3; s++) {
    const x0 = s * 43;
    const top = 22 + Math.floor(rnd() * 8);
    const col = WARM[(seed + s) % WARM.length];
    // 遮阳棚
    for (let x = x0; x < x0 + 42; x += 6) {
      a.rect(x, top, 3, 7, col);
      a.rect(x + 3, top, 3, 7, '#ffffff');
    }
    for (let x = x0; x < x0 + 42; x += 3) a.set(x + 1, top + 7, col);
    // 摊位：暖光
    a.rect(x0 + 1, top + 8, 40, H - top - 8, '#3a2a22');
    a.rect(x0 + 3, top + 10, 36, 18, '#ffd27a');
    for (let i = 0; i < 5; i++) {
      const fx = x0 + 6 + Math.floor(rnd() * 28);
      a.rect(fx, top + 20, 5, 6, ['#c94a2a', '#ffb347', '#5cc77a', '#ffffff'][i % 4]);
    }
    a.rect(x0 + 1, top + 28, 40, 4, '#c98a4b');
    // 灯泡串
    for (let x = x0 + 2; x < x0 + 42; x += 5) a.set(x, top - 2 + (x % 2), '#fff1a8');
    signs.push({ x: x0 + 21, y: top - 9, text: names[(seed + s) % names.length], color: col });
  }
  a.rect(0, H - 4, W, 4, '#2b2427');
  const c = a.toCanvas();
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const s of signs) {
    g.fillStyle = INK;
    g.fillRect(s.x - 19, s.y - 6, 38, 12);
    g.fillStyle = s.color;
    g.fillRect(s.x - 18, s.y - 5, 36, 10);
    g.fillStyle = '#ffffff';
    g.font = 'bold 8px ' + FONT;
    g.fillText(s.text, s.x, s.y + 0.5);
  }
  return c;
}

function makeMarketSky(palette) {
  const W = 256;
  const H = 128;
  const a = new PixelArt(W, H);
  for (let y = 0; y < H; y++) a.rect(0, y, W, 1, mixHex(palette.skyTop, palette.skyBottom, Math.pow(y / (H - 1), 1.6)));
  const rnd = seededRandom(23);
  for (let i = 0; i < 40; i++) a.set(Math.floor(rnd() * W), Math.floor(rnd() * 60), rnd() < 0.3 ? '#ffffff' : '#c9b8e8');
  // 横跨天空的彩灯串
  for (let k = 0; k < 2; k++) {
    for (let x = 0; x < W; x++) {
      const y = 50 + k * 22 + Math.round(Math.sin((x / W) * Math.PI * 4 + k) * 6);
      a.set(x, y, '#5a4636');
      if (x % 9 === 0) a.disc(x, y + 2, 1.4, WARM[(x / 9 + k) % WARM.length]);
    }
  }
  a.rect(0, H - 2, W, 2, palette.fog);
  return a.toCanvas();
}

/** 悬挂的灯笼招牌（文字来自 config.memes.marketSigns） */
function makeLanternSign(text, color) {
  const tmp = makeCanvas(8, 8).getContext('2d');
  tmp.font = 'bold 9px ' + FONT;
  const tw = Math.ceil(tmp.measureText(text).width);
  const w = Math.max(30, tw + 10);
  const h = 30;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#5a4636';
  g.fillRect(3, 0, 1, 4);
  g.fillRect(w - 4, 0, 1, 4);
  g.fillStyle = INK;
  g.fillRect(0, 4, w, 13);
  g.fillStyle = color;
  g.fillRect(1, 5, w - 2, 11);
  g.fillStyle = '#fff6c2';
  g.font = 'bold 9px ' + FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 10.5);
  // 下面挂两个小灯笼
  for (const x of [5, w - 6]) {
    g.fillStyle = INK;
    g.fillRect(x - 3, 18, 7, 9);
    g.fillStyle = '#ff3d3d';
    g.fillRect(x - 2, 19, 5, 7);
    g.fillStyle = '#ffd23f';
    g.fillRect(x - 2, 19, 5, 1);
    g.fillRect(x, 27, 1, 2);
  }
  return c;
}

/** 夜市关专属素材 */
export function buildMarketSprites(level, signs) {
  const S = SPRITES;
  S.snackCart = drawSnackCart();
  S.stools = drawStools();
  S.lanterns = [null, drawLanterns(1), drawLanterns(2), drawLanterns(3)];
  S.skewer = drawSkewer();
  const c0 = drawCrowd(0);
  const c1 = drawCrowd(1);
  S.crowdR = [c0.toCanvas(), c1.toCanvas()];
  S.crowdL = [c0.flipped().toCanvas(), c1.flipped().toCanvas()];
  const h0 = drawHawker(0);
  const h1 = drawHawker(1);
  S.hawkerR = [h0.toCanvas(), h1.toCanvas()];
  S.hawkerL = [h0.flipped().toCanvas(), h1.flipped().toCanvas()];
  S.shoutBubble = drawShoutBubble();
  S.takoBall = drawTakoBall(false, 14);
  S.giantTako = drawTakoBall(false, 30);
  S.giantTakoGlow = drawTakoBall(true, 30);
  S.beatWave = [drawBeatWave(0), drawBeatWave(1)];
  S.tentacle = drawTentacle();

  const arts = {};
  for (const e of ['normal', 'angry', 'dizzy', 'hurt']) arts[e] = drawZhang(e);
  registerBoss('zhang', arts, [16, 10, 32, 32]);

  const names = signs && signs.length ? signs : ['夜市'];
  const walls = [makeMarketWall(1, names), makeMarketWall(2, names), makeMarketWall(3, names), makeMarketWall(4, names)];
  const list = names.map((n, i) => makeLanternSign(n, WARM[i % WARM.length]));
  S.levelAssets[level.id] = { walls, signs: list, sky: makeMarketSky(level.palette) };
  return S;
}

/** 章章的触手（车道封锁）：从天而降按住一条道的紫色触手，带吸盘 */
function drawTentacle() {
  const a = new PixelArt(22, 52);
  // 上细下粗的弯曲触手
  for (let y = 0; y < 46; y++) {
    const t = y / 46;
    const w = 2.2 + t * 5.2;
    const cx = 11 + Math.sin(y * 0.13 + 1) * (1.5 + t * 2.2);
    for (let x = -6; x <= 6; x += 0.5) {
      if (Math.abs(x) <= w) a.set(cx + x, y, Math.abs(x) > w - 1.2 ? '#7a4ba8' : '#a06bd6');
    }
  }
  // 末端卷曲
  a.disc(13, 47, 4.2, '#a06bd6');
  a.disc(13.6, 46.4, 2.6, '#c79ae8');
  // 吸盘
  for (let y = 8; y < 44; y += 5) {
    const cx = 11 + Math.sin(y * 0.13 + 1) * (1.5 + (y / 46) * 2.2);
    a.disc(cx, y + 1.5, 1.3, '#e8c6ff');
    a.set(cx, y + 1.5, '#b980e0');
  }
  a.outline(INK);
  return a.toCanvas();
}
