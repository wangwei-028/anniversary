import { PixelArt, makeCanvas, seededRandom, mixHex } from './pixel.js';

/**
 * 程序化像素素材：主角（女孩）、障碍、拾取物、Boss、弹幕、HUD 图标、墙面贴图。
 * 全部在启动时用代码画好，缓存成离屏 Canvas；绘制时只做 drawImage（整数倍或透视缩放，最近邻采样）。
 * 美术密度：16 像素 = 1 米（data/constants.js 的 WORLD.spritePxPerMeter）。
 */

export const INK = '#3b1f3a';

/** 女主角配色 */
const GIRL = {
  hair: '#6b3b2a',
  hairHi: '#9a5a42',
  hairDark: '#4a271c',
  bow: '#ff4f8b',
  bowDark: '#c42a62',
  skin: '#ffd9bf',
  dress: '#ff8cba',
  dressDark: '#e5609a',
  frill: '#ffffff',
  sock: '#ffffff',
  shoe: '#d0336a',
  eye: '#3b1f3a',
  blush: '#ff9cb8',
  mouth: '#d6456f',
};

export const SPRITES = {};

/** 男友酱配色（字段名与 GIRL 对齐，腿 / 手臂绘制函数通用） */
const BOY = {
  hair: '#2b2230',
  hairHi: '#4c3d52',
  skin: '#ffd9bf',
  dress: '#4f8fff',
  dressDark: '#3567c9',
  pants: '#2f3b66',
  sock: '#2f3b66',
  shoe: '#ffffff',
  eye: '#3b1f3a',
  blush: '#ffb3a6',
  mouth: '#c9485f',
};

/** 当前正在生成的皮肤：G / B = 女友酱 / 男友酱配色，ACC = 配饰（猫耳 / 头纱 / 星星……） */
let G = GIRL;
let B = BOY;
let ACC = {};

/** 皮肤外观（数值加成在 data/skins.js） */
const SKIN_LOOKS = {
  default: { girl: GIRL, boy: BOY, acc: {} },
  cat: {
    girl: { ...GIRL, dress: '#ffb86b', dressDark: '#e58f3c', frill: '#fff3e0', bow: '#ffb86b', bowDark: '#e58f3c' },
    boy: { ...BOY, dress: '#6a6a80', dressDark: '#4f4f63', pants: '#3b3b4f', sock: '#3b3b4f' },
    acc: { cat: true },
  },
  wedding: {
    girl: { ...GIRL, dress: '#ffffff', dressDark: '#e3def0', frill: '#fff0f6', sock: '#ffffff', shoe: '#f2f0ff', bow: '#ff8cba', bowDark: '#ff5c9a' },
    boy: { ...BOY, dress: '#2b2b38', dressDark: '#1d1d28', pants: '#2b2b38', sock: '#2b2b38', shoe: '#1d1d28' },
    acc: { wedding: true },
  },
  starlight: {
    girl: { ...GIRL, dress: '#2a2f6b', dressDark: '#1d2050', frill: '#ffe066', bow: '#ffe066', bowDark: '#e0a400', shoe: '#ffe066' },
    boy: { ...BOY, dress: '#2a2f6b', dressDark: '#1d2050', pants: '#1d2050', sock: '#1d2050', shoe: '#ffe066' },
    acc: { stars: true },
  },
};

/** 配饰：view = back / front / slide，who = girl / boy */
function drawAcc(a, view, by, who) {
  const C = who === 'girl' ? G : B;
  if (ACC.cat) {
    // 猫耳
    const ey = view === 'slide' ? 4 : 1 + by;
    const ear = who === 'girl' ? C.bow : C.dress;
    a.set(4, ey, ear);
    a.rect(4, ey + 1, 2, 1, ear);
    a.set(11, ey, ear);
    a.rect(10, ey + 1, 2, 1, ear);
    a.set(5, ey + 1, '#ffd6e7');
    a.set(10, ey + 1, '#ffd6e7');
    // 尾巴（背面才看得到）
    if (view === 'back') {
      a.set(12, 11 + by, C.dressDark);
      a.set(13, 10 + by, C.dressDark);
      a.set(13, 9 + by, C.dressDark);
      a.set(14, 8 + by, C.dressDark);
    }
  }
  if (ACC.wedding) {
    if (who === 'girl') {
      // 白头纱（背面盖住半个后背）
      if (view === 'back') {
        a.rect(5, 4 + by, 6, 5, '#f4f0ff');
        a.set(6, 5 + by, '#ffffff');
        a.set(9, 6 + by, '#ffffff');
      } else if (view === 'front') {
        a.set(3, 4 + by, '#f4f0ff');
        a.rect(3, 5 + by, 1, 5, '#f4f0ff');
        a.set(12, 4 + by, '#f4f0ff');
        a.rect(12, 5 + by, 1, 5, '#f4f0ff');
      }
    } else if (view === 'front') {
      // 男友酱：白衬衫 + 红领结
      a.rect(7, 8 + by, 2, 3, '#ffffff');
      a.set(6, 8 + by, '#e8344f');
      a.set(9, 8 + by, '#e8344f');
      a.rect(7, 8 + by, 2, 1, '#e8344f');
    }
  }
  if (ACC.stars) {
    const gold = '#ffe066';
    if (view === 'slide') {
      a.set(6, 11, gold);
      a.set(9, 12, gold);
    } else {
      a.set(6, 9 + by, gold);
      a.set(9, 10 + by, gold);
      a.set(7, 11 + by, '#ffffff');
      if (who === 'girl') a.set(10, 12 + by, gold);
    }
  }
}

// ------------------------------------------------------------------
// 女主角（背面：局内奔跑；正面：标题/结算）
// ------------------------------------------------------------------

function girlLeg(a, x, state, by, C = G) {
  if (state === 'up') {
    a.rect(x, 13 + by, 2, 1, C.skin);
    a.rect(x, 14 + by, 2, 1, C.shoe);
  } else if (state === 'tuck') {
    a.rect(x, 13 + by, 2, 1, C.shoe);
  } else {
    a.rect(x, 13 + by, 2, 1, C.skin);
    a.rect(x, 14 + by, 2, 1, C.sock);
    a.rect(x, 15 + by, 2, 1, C.shoe);
  }
}

function girlArm(a, x, state, by, dir, C = G) {
  a.set(x, 8 + by, C.dress); // 泡泡袖 / 卫衣袖
  switch (state) {
    case 'fwd':
      a.set(x, 9 + by, C.skin);
      break;
    case 'back':
      a.rect(x, 9 + by, 1, 3, C.skin);
      break;
    case 'up':
      a.set(x + dir, 7 + by, C.skin);
      a.set(x + dir, 6 + by, C.skin);
      a.set(x + dir, 5 + by, C.skin);
      break;
    case 'out':
      a.set(x + dir, 8 + by, C.skin);
      a.set(x + 2 * dir, 7 + by, C.skin);
      break;
    default:
      a.rect(x, 9 + by, 1, 2, C.skin);
  }
}

function girlBow(a, by) {
  const C = G;
  a.set(4, 1 + by, C.bow);
  a.set(5, 1 + by, C.bow);
  a.set(10, 1 + by, C.bow);
  a.set(11, 1 + by, C.bow);
  a.rect(4, 2 + by, 3, 1, C.bow);
  a.rect(9, 2 + by, 3, 1, C.bow);
  a.rect(7, 2 + by, 2, 1, C.bowDark);
  a.set(5, 3 + by, C.bow);
  a.set(10, 3 + by, C.bow);
}

/** 背面姿势：pose = { bob, legL, legR, armL, armR, pony, ponyUp, flare } */
function girlBack(p) {
  const C = G;
  const a = new PixelArt(16, 16);
  const by = p.bob || 0;
  girlLeg(a, 5, p.legL, by);
  girlLeg(a, 9, p.legR, by);
  const fl = p.flare ? 1 : 0;
  a.rect(4 - fl, 11 + by, 8 + fl * 2, 1, C.dress);
  a.rect(4 - fl, 12 + by, 8 + fl * 2, 1, C.frill);
  a.set(4 - fl, 11 + by, C.dressDark);
  a.set(11 + fl, 11 + by, C.dressDark);
  a.rect(5, 8 + by, 6, 3, C.dress);
  a.rect(5, 10 + by, 6, 1, C.dressDark);
  girlArm(a, 4, p.armL, by, -1);
  girlArm(a, 11, p.armR, by, 1);
  // 头发（背面全是头发）
  a.rect(5, 2 + by, 6, 1, C.hair);
  a.rect(4, 3 + by, 8, 4, C.hair);
  a.rect(5, 7 + by, 6, 1, C.hair);
  a.set(6, 3 + by, C.hairHi);
  a.set(7, 3 + by, C.hairHi);
  a.set(5, 4 + by, C.hairHi);
  // 马尾
  const pn = p.pony || 0;
  if (p.ponyUp) {
    a.rect(7, 6 + by, 2, 2, C.hairDark);
    a.set(7 + pn, 8 + by, C.hairDark);
  } else {
    a.rect(7, 7 + by, 2, 2, C.hairDark);
    a.rect(7 + pn, 9 + by, 2, 1, C.hairDark);
    a.set(pn >= 0 ? 8 + pn : 7 + pn, 10 + by, C.hairDark);
  }
  girlBow(a, by);
  drawAcc(a, 'back', by, 'girl');
  a.outline(INK);
  return a;
}

function girlSlide() {
  const C = G;
  const a = new PixelArt(16, 16);
  a.rect(2, 15, 2, 1, C.shoe);
  a.rect(12, 15, 2, 1, C.shoe);
  a.set(3, 14, C.skin);
  a.set(12, 14, C.skin);
  a.rect(3, 13, 10, 1, C.frill);
  a.rect(4, 12, 8, 1, C.dress);
  a.rect(5, 10, 6, 2, C.dress);
  a.set(4, 10, C.dress);
  a.set(11, 10, C.dress);
  a.set(3, 11, C.skin);
  a.set(2, 11, C.skin);
  a.set(12, 11, C.skin);
  a.set(13, 11, C.skin);
  // 马尾被风吹起
  a.rect(7, 3, 2, 2, C.hairDark);
  a.set(8, 2, C.hairDark);
  a.set(9, 1, C.hairDark);
  // 低头的脑袋
  a.rect(5, 5, 6, 1, C.hair);
  a.rect(4, 6, 8, 3, C.hair);
  a.rect(5, 9, 6, 1, C.hair);
  a.set(6, 6, C.hairHi);
  a.set(5, 7, C.hairHi);
  a.set(4, 4, C.bow);
  a.set(11, 4, C.bow);
  a.rect(4, 5, 3, 1, C.bow);
  a.rect(9, 5, 3, 1, C.bow);
  a.rect(7, 5, 2, 1, C.bowDark);
  drawAcc(a, 'slide', 0, 'girl');
  a.outline(INK);
  return a;
}

/** 正面姿势：pose = { arms: 'down'|'up'|'wave', eyes: 'open'|'closed', mouth: 'smile'|'open'|'sad', bob } */
function girlFront(p) {
  const C = G;
  const a = new PixelArt(16, 16);
  const by = p.bob || 0;
  girlLeg(a, 5, 'down', by);
  girlLeg(a, 9, 'down', by);
  a.rect(4, 11 + by, 8, 1, C.dress);
  a.rect(4, 12 + by, 8, 1, C.frill);
  a.rect(5, 8 + by, 6, 3, C.dress);
  a.set(7, 8 + by, C.dressDark);
  a.set(8, 8 + by, C.dressDark);
  a.rect(5, 10 + by, 6, 1, C.dressDark);
  if (p.arms === 'up') {
    girlArm(a, 4, 'up', by, -1);
    girlArm(a, 11, 'up', by, 1);
  } else if (p.arms === 'wave') {
    girlArm(a, 4, 'down', by, -1);
    girlArm(a, 11, 'up', by, 1);
  } else {
    girlArm(a, 4, 'down', by, -1);
    girlArm(a, 11, 'down', by, 1);
  }
  // 头发 + 脸
  a.rect(5, 2 + by, 6, 1, C.hair);
  a.rect(4, 3 + by, 8, 5, C.hair);
  a.rect(4, 8 + by, 1, 1, C.hair);
  a.rect(11, 8 + by, 1, 1, C.hair);
  a.rect(5, 5 + by, 6, 3, C.skin);
  a.rect(6, 4 + by, 4, 1, C.skin);
  a.set(7, 4 + by, C.hair); // 刘海
  a.set(6, 3 + by, C.hairHi);
  a.set(9, 3 + by, C.hairHi);
  if (p.eyes === 'closed') {
    a.set(6, 6 + by, C.eye);
    a.set(9, 6 + by, C.eye);
  } else {
    a.rect(6, 5 + by, 1, 2, C.eye);
    a.rect(9, 5 + by, 1, 2, C.eye);
  }
  if (p.mouth === 'sad') {
    // 难过：眼角挂着泪珠
    a.set(6, 7 + by, '#7fd0ff');
    a.set(9, 7 + by, '#7fd0ff');
  } else {
    a.set(5, 7 + by, C.blush);
    a.set(10, 7 + by, C.blush);
  }
  if (p.mouth === 'open') {
    a.rect(7, 7 + by, 2, 1, C.mouth);
  } else if (p.mouth === 'sad') {
    a.set(7, 7 + by, C.mouth);
    a.set(8, 7 + by, C.mouth);
  } else {
    a.set(7, 7 + by, C.mouth);
    a.set(8, 7 + by, C.mouth);
  }
  girlBow(a, by);
  drawAcc(a, 'front', by, 'girl');
  a.outline(INK);
  return a;
}

// ------------------------------------------------------------------
// 男友酱（伙伴能力"守护换人"）：短发 + 蓝色卫衣
// ------------------------------------------------------------------

function boyLegC() {
  return { skin: B.pants, sock: B.pants, shoe: B.shoe };
}

function boySleeveC() {
  return { dress: B.dress, skin: B.dress };
}

function boyBack(p) {
  const C = B;
  const BOY_LEG = boyLegC();
  const BOY_SLEEVE = boySleeveC();
  const a = new PixelArt(16, 16);
  const by = p.bob || 0;
  girlLeg(a, 5, p.legL, by, BOY_LEG);
  girlLeg(a, 9, p.legR, by, BOY_LEG);
  a.rect(5, 12 + by, 6, 1, C.pants);
  a.rect(5, 8 + by, 6, 4, C.dress);
  a.rect(5, 11 + by, 6, 1, C.dressDark);
  a.rect(6, 8 + by, 4, 2, C.dressDark); // 背后的帽兜
  girlArm(a, 4, p.armL, by, -1, BOY_SLEEVE);
  girlArm(a, 11, p.armR, by, 1, BOY_SLEEVE);
  a.rect(5, 2 + by, 6, 1, C.hair);
  a.rect(4, 3 + by, 8, 4, C.hair);
  a.rect(6, 7 + by, 4, 1, C.skin);
  a.set(4, 5 + by, C.skin);
  a.set(11, 5 + by, C.skin);
  a.set(6, 3 + by, C.hairHi);
  a.set(7, 3 + by, C.hairHi);
  a.set(8, 1 + by, C.hair); // 呆毛
  drawAcc(a, 'back', by, 'boy');
  a.outline(INK);
  return a;
}

function boySlide() {
  const C = B;
  const a = new PixelArt(16, 16);
  a.rect(2, 15, 2, 1, C.shoe);
  a.rect(12, 15, 2, 1, C.shoe);
  a.set(3, 14, C.pants);
  a.set(12, 14, C.pants);
  a.rect(3, 13, 10, 1, C.pants);
  a.rect(4, 11, 8, 2, C.dress);
  a.rect(4, 12, 8, 1, C.dressDark);
  a.rect(5, 10, 6, 1, C.dress);
  a.set(3, 11, C.dress);
  a.set(2, 11, C.skin);
  a.set(12, 11, C.dress);
  a.set(13, 11, C.skin);
  a.rect(5, 5, 6, 1, C.hair);
  a.rect(4, 6, 8, 3, C.hair);
  a.rect(6, 9, 4, 1, C.skin);
  a.set(6, 6, C.hairHi);
  a.set(8, 4, C.hair);
  drawAcc(a, 'slide', 0, 'boy');
  a.outline(INK);
  return a;
}

function boyFront(p) {
  const C = B;
  const BOY_LEG = boyLegC();
  const BOY_SLEEVE = boySleeveC();
  const a = new PixelArt(16, 16);
  const by = p.bob || 0;
  girlLeg(a, 5, 'down', by, BOY_LEG);
  girlLeg(a, 9, 'down', by, BOY_LEG);
  a.rect(5, 12 + by, 6, 1, C.pants);
  a.rect(5, 8 + by, 6, 4, C.dress);
  a.rect(5, 11 + by, 6, 1, C.dressDark);
  a.set(7, 9 + by, '#ffffff'); // 卫衣抽绳
  a.set(8, 9 + by, '#ffffff');
  const armR = p.arms === 'up' || p.arms === 'wave' ? 'up' : 'down';
  girlArm(a, 4, p.arms === 'up' ? 'up' : 'down', by, -1, BOY_SLEEVE);
  girlArm(a, 11, armR, by, 1, BOY_SLEEVE);
  a.rect(5, 2 + by, 6, 1, C.hair);
  a.rect(4, 3 + by, 8, 3, C.hair);
  a.rect(5, 5 + by, 6, 3, C.skin);
  a.rect(5, 4 + by, 3, 1, C.hair); // 斜刘海
  a.set(4, 6 + by, C.hair);
  a.set(11, 6 + by, C.hair);
  if (p.eyes === 'closed') {
    a.set(6, 6 + by, C.eye);
    a.set(9, 6 + by, C.eye);
  } else {
    a.rect(6, 5 + by, 1, 2, C.eye);
    a.rect(9, 5 + by, 1, 2, C.eye);
  }
  a.set(5, 7 + by, C.blush);
  a.set(10, 7 + by, C.blush);
  a.set(7, 7 + by, C.mouth);
  a.set(8, 7 + by, C.mouth);
  a.set(8, 1 + by, C.hair);
  drawAcc(a, 'front', by, 'boy');
  a.outline(INK);
  return a;
}

// ------------------------------------------------------------------
// 拾取物 & 图标
// ------------------------------------------------------------------

function drawCoinFrame(rx, blank) {
  const a = new PixelArt(12, 12);
  const gold = '#ffd23f';
  const rim = '#e8a21b';
  const shine = '#fff6c2';
  if (rx >= 4) {
    a.disc(6, 6, 4.8, rim);
    a.disc(6, 6, 3.7, gold);
    a.set(4, 3, shine);
    a.set(3, 4, shine);
    a.set(4, 4, shine);
    // 中间的小爱心（可以在 config.coinMark 换成你们的暗号 / 她的头像）
    if (!blank) {
      a.set(5, 5, rim);
      a.set(7, 5, rim);
      a.rect(5, 6, 3, 1, rim);
      a.set(6, 7, rim);
    }
  } else if (rx >= 2) {
    a.ellipse(6, 6, 3, 4.8, rim);
    a.ellipse(6, 6, 2, 3.7, gold);
    a.set(5, 4, shine);
  } else {
    a.rect(5, 1, 2, 10, rim);
    a.rect(5, 2, 1, 8, gold);
  }
  a.outline(INK);
  return a.toCanvas();
}

function drawHeart(fill, hi, w = 9) {
  const rows = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
  const a = new PixelArt(w + 2, rows.length + 2);
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === 'X') a.set(x + 1, y + 1, fill);
  if (hi) {
    a.set(2, 2, hi);
    a.set(3, 2, hi);
    a.set(2, 3, hi);
  }
  a.outline(INK);
  return a.toCanvas();
}

function drawSmallHeart(color) {
  const rows = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
  const a = new PixelArt(5, 5);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (rows[y][x] === 'X') a.set(x, y, color);
  return a.toCanvas();
}

function drawStar(color) {
  const rows = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..'];
  const a = new PixelArt(5, 5);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (rows[y][x] === 'X') a.set(x, y, color);
  return a.toCanvas();
}

function drawMagnet() {
  const a = new PixelArt(14, 14);
  a.disc(7, 7.5, 5.6, '#ff4a5e');
  a.clearDisc(7, 7.5, 2.4);
  a.clearRect(4, 0, 6, 7);
  a.rect(1, 2, 3, 3, '#e6ecf5');
  a.rect(10, 2, 3, 3, '#e6ecf5');
  a.rect(1, 5, 3, 2, '#ff4a5e');
  a.rect(10, 5, 3, 2, '#ff4a5e');
  a.set(2, 8, '#ff9aa5');
  a.outline(INK);
  return a.toCanvas();
}

function drawShieldPickup() {
  const a = new PixelArt(14, 14);
  a.disc(7, 7, 6, '#4fb3ff');
  a.disc(7, 7, 5, '#9fdcff');
  a.set(4, 4, '#ffffff');
  a.set(5, 3, '#ffffff');
  a.set(4, 5, '#ffffff');
  a.set(9, 10, '#ffffff');
  a.outline(INK);
  return a.toCanvas();
}

function drawCoinRain() {
  const a = new PixelArt(16, 14);
  a.disc(6, 6, 4.5, '#e8a21b');
  a.disc(6, 6, 3.5, '#ffd23f');
  a.disc(10, 8, 4.5, '#e8a21b');
  a.disc(10, 8, 3.5, '#ffd23f');
  a.set(9, 6, '#fff6c2');
  a.text('x2', 5, 7, '#ffffff');
  a.outline(INK);
  return a.toCanvas();
}

function drawShoes() {
  const a = new PixelArt(16, 14);
  // 翅膀
  a.rect(1, 3, 3, 1, '#ffffff');
  a.rect(0, 4, 5, 1, '#ffffff');
  a.rect(1, 5, 4, 1, '#ffffff');
  // 鞋身
  a.rect(4, 6, 7, 4, '#ff6fa5');
  a.rect(10, 7, 3, 3, '#ff6fa5');
  a.rect(3, 10, 11, 2, '#ffffff');
  a.set(6, 7, '#ffffff');
  a.set(8, 7, '#ffffff');
  a.rect(5, 12, 2, 1, '#8f9bb3'); // 弹簧
  a.rect(10, 12, 2, 1, '#8f9bb3');
  a.outline(INK);
  return a.toCanvas();
}

function drawBolt(color) {
  const rows = ['..XX', '.XX.', 'XXXX', '.XX.', 'XX..', 'X...'];
  const a = new PixelArt(6, 8);
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < 4; x++) if (rows[y][x] === 'X') a.set(x + 1, y + 1, color);
  a.outline(INK);
  return a.toCanvas();
}

function drawShieldIcon() {
  const a = new PixelArt(11, 11);
  a.disc(5.5, 5.5, 4.5, '#4fb3ff');
  a.disc(5.5, 5.5, 3.4, '#bfe8ff');
  a.set(3, 3, '#ffffff');
  a.set(4, 3, '#ffffff');
  a.outline(INK);
  return a.toCanvas();
}

function drawBubble(r) {
  const size = r * 2 + 2;
  const a = new PixelArt(size, size);
  a.ring(size / 2, size / 2, r, r, 1.2, '#8fd8ff');
  a.set(Math.round(size * 0.3), Math.round(size * 0.25), '#ffffff');
  a.set(Math.round(size * 0.3) + 1, Math.round(size * 0.25), '#ffffff');
  a.set(Math.round(size * 0.27), Math.round(size * 0.3), '#ffffff');
  return a.toCanvas();
}

/** 半透明椭圆影子 */
function drawShadow(w, h) {
  const c = makeCanvas(w, h);
  const a = new PixelArt(w, h);
  a.ellipse(w / 2, h / 2, w / 2, h / 2, '#000000');
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const col = ((90 << 24) | (0x30 << 16) | (0x15 << 8) | 0x2a) >>> 0;
  const dst = new Uint32Array(img.data.buffer);
  for (let i = 0; i < a.buf.length; i++) dst[i] = a.buf[i] ? col : 0;
  ctx.putImageData(img, 0, 0);
  return c;
}

function drawRing(color, fillAlpha) {
  const w = 40;
  const h = 14;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const a = new PixelArt(w, h);
  a.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, color);
  const fill = new PixelArt(w, h);
  fill.ellipse(w / 2, h / 2, w / 2 - 3, h / 2 - 2.5, color);
  const img = ctx.createImageData(w, h);
  const dst = new Uint32Array(img.data.buffer);
  for (let i = 0; i < a.buf.length; i++) {
    if (fill.buf[i]) dst[i] = fillAlpha ? ((fillAlpha << 24) | (a.buf[i] & 0xffffff)) >>> 0 : 0;
    else if (a.buf[i]) dst[i] = a.buf[i];
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------------
// 商场关障碍
// ------------------------------------------------------------------

function drawCart(tint) {
  const a = new PixelArt(30, 21);
  const silver = tint ? '#ffd0dc' : '#dfe5f0';
  const grid = tint ? '#e07a98' : '#9aa6bd';
  const red = '#ff4f6d';
  const redDark = '#c92a4a';
  const dark = '#4a4a5e';
  a.rect(3, 1, 24, 2, red);
  a.rect(3, 2, 24, 1, redDark);
  for (let y = 3; y <= 13; y++) {
    const inset = Math.floor((y - 3) / 4);
    a.rect(2 + inset, y, 26 - inset * 2, 1, silver);
    for (let x = 2 + inset; x < 28 - inset; x++) {
      if ((x - 2) % 3 === 0 || (y - 3) % 3 === 0) a.set(x, y, grid);
    }
  }
  // 车头的小爱心牌
  a.rect(12, 6, 6, 5, '#ffffff');
  a.set(13, 7, '#ff6fa5');
  a.set(16, 7, '#ff6fa5');
  a.rect(13, 8, 4, 1, '#ff6fa5');
  a.rect(14, 9, 2, 1, '#ff6fa5');
  a.rect(5, 14, 20, 2, dark);
  a.rect(5, 16, 4, 4, dark);
  a.rect(21, 16, 4, 4, dark);
  a.set(6, 17, '#b8bfd0');
  a.set(22, 17, '#b8bfd0');
  a.outline(INK);
  return a.toCanvas();
}

function drawBanner(lanes) {
  // 画布 36px（2.25m）：横幅布吊在 ~1.4m 以上，下方留出明显的滑铲空间
  const w = Math.round(lanes * 38.4) + 2;
  const a = new PixelArt(w, 36);
  const pole = '#8f9bb3';
  a.rect(1, 2, 2, 34, pole);
  a.rect(w - 3, 2, 2, 34, pole);
  a.rect(2, 2, 1, 34, '#c3cad8');
  a.rect(w - 2, 2, 1, 34, '#c3cad8');
  a.rect(0, 0, 4, 2, '#ffd23f');
  a.rect(w - 4, 0, 4, 2, '#ffd23f');
  a.rect(3, 2, w - 6, 11, '#ff5c9a');
  a.rect(3, 2, w - 6, 1, '#ffffff');
  a.rect(3, 12, w - 6, 1, '#ffffff');
  for (let x = 3; x < w - 3; x += 2) a.set(x, 13, '#ff5c9a');
  // "SALE" 字样
  const word = 'SALE';
  const ww = PixelArt.textWidth(word);
  const n = Math.max(1, Math.floor((w - 8) / (ww + 8)));
  const total = n * ww + (n - 1) * 8;
  let x0 = Math.floor((w - total) / 2);
  for (let i = 0; i < n; i++) {
    a.text(word, x0, 5, '#ffffff');
    x0 += ww + 8;
  }
  a.outline(INK);
  return a.toCanvas();
}

function drawPlanter() {
  const a = new PixelArt(36, 40);
  const rnd = seededRandom(7);
  a.disc(18, 14, 12.5, '#3fa35f');
  a.disc(16.5, 12.5, 11, '#5cc77a');
  a.disc(13, 9, 4, '#8fe0a3');
  for (let i = 0; i < 9; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = rnd() * 9;
    const x = Math.round(17 + Math.cos(ang) * r);
    const y = Math.round(13 + Math.sin(ang) * r * 0.9);
    const col = i % 3 === 0 ? '#ffe066' : '#ff6fa5';
    a.rect(x, y, 2, 2, col);
    a.set(x, y, '#ffffff');
  }
  a.rect(3, 24, 30, 16, '#fff6fa');
  a.rect(3, 24, 30, 2, '#ff8cba');
  for (let x = 3; x < 33; x += 6) a.rect(x, 26, 1, 14, '#ffc2da');
  a.rect(3, 32, 30, 1, '#ffc2da');
  a.outline(INK);
  return a.toCanvas();
}

function drawTourists(frame) {
  const a = new PixelArt(38, 37);
  const skin = '#ffd9bf';
  const hairDark = '#3b2a22';
  const lift = frame ? 1 : 0;
  // 爸爸
  a.rect(4, 22, 3, 12 - lift, '#2f3b66');
  a.rect(8, 22, 3, 12 - (1 - lift), '#2f3b66');
  a.rect(4, 34 - lift, 3, 2, '#4a4a5e');
  a.rect(8, 34 - (1 - lift), 3, 2, '#4a4a5e');
  a.rect(3, 10, 9, 13, '#4f8fff');
  a.rect(2, 11, 1, 9, skin);
  a.rect(12, 11, 1, 8, skin);
  a.disc(7.5, 6, 3.6, skin);
  a.rect(4, 1, 7, 3, hairDark);
  a.set(6, 6, INK);
  a.set(9, 6, INK);
  a.rect(5, 13, 5, 1, '#ffffff'); // 相机带
  a.rect(6, 14, 3, 2, '#4a4a5e');
  // 妈妈
  a.rect(15, 5, 9, 9, '#7a4a32');
  a.disc(19.5, 9, 3.4, skin);
  a.set(18, 9, INK);
  a.set(21, 9, INK);
  for (let y = 14; y <= 29; y++) {
    const half = 3 + Math.floor((y - 14) / 4);
    a.rect(19 - half, y, half * 2 + 1, 1, '#ffd23f');
  }
  a.rect(14, 15, 1, 8, skin);
  a.rect(25, 15, 1, 8, skin);
  a.rect(17, 30, 2, 4 - lift, skin);
  a.rect(21, 30, 2, 4 - (1 - lift), skin);
  a.rect(17, 34 - lift, 2, 2, '#c94a6a');
  a.rect(21, 34 - (1 - lift), 2, 2, '#c94a6a');
  // 小孩
  a.disc(31, 20, 3.2, skin);
  a.rect(28, 16, 7, 2, hairDark);
  a.set(30, 20, INK);
  a.set(32, 20, INK);
  a.rect(28, 24, 7, 7, '#ff5c5c');
  a.rect(28, 31, 7, 2, '#2f3b66');
  a.rect(29, 33, 2, 2 - lift, skin);
  a.rect(32, 33, 2, 2 - (1 - lift), skin);
  a.rect(29, 35 - lift, 2, 1, '#4a4a5e');
  a.rect(32, 35 - (1 - lift), 2, 1, '#4a4a5e');
  a.rect(26, 24, 2, 1, skin); // 牵手
  a.rect(13, 18, 1, 1, skin);
  // 小气球
  a.line(35, 24, 36, 12, '#8a7a90');
  a.disc(36, 9, 2.6, '#ff6fa5');
  a.outline(INK);
  return a.toCanvas();
}

function drawGiftBox(body, lid, ribbon) {
  const a = new PixelArt(16, 16);
  a.rect(2, 6, 12, 9, body);
  a.rect(1, 5, 14, 3, lid);
  a.rect(7, 5, 2, 10, ribbon);
  a.disc(5, 3, 2.2, ribbon);
  a.disc(11, 3, 2.2, ribbon);
  a.clearDisc(5, 3, 0.8);
  a.clearDisc(11, 3, 0.8);
  a.rect(7, 3, 2, 2, mixHex(ribbon, '#000000', 0.2));
  a.set(3, 8, '#ffffff');
  a.outline(INK);
  return a.toCanvas();
}

function drawBlindBox() {
  const a = new PixelArt(16, 16);
  a.rect(2, 4, 12, 11, '#a77bff');
  a.rect(1, 3, 14, 3, '#c3a3ff');
  a.rect(2, 13, 12, 2, '#8a5ce6');
  a.text('?', 7, 7, '#ffffff');
  a.set(3, 7, '#e2d4ff');
  a.outline(INK);
  return a.toCanvas();
}

function drawGiantGift(glow) {
  const a = new PixelArt(30, 30);
  const body = glow ? '#ffe066' : '#ff6fa5';
  const lid = glow ? '#fff1a8' : '#ff9cc4';
  const ribbon = glow ? '#ff6fa5' : '#ffd23f';
  a.rect(3, 11, 24, 17, body);
  a.rect(2, 9, 26, 5, lid);
  a.rect(13, 9, 4, 19, ribbon);
  a.rect(3, 18, 24, 3, ribbon);
  a.disc(9, 5.5, 4.5, ribbon);
  a.disc(21, 5.5, 4.5, ribbon);
  a.clearDisc(9, 5.5, 1.8);
  a.clearDisc(21, 5.5, 1.8);
  a.rect(13, 5, 4, 5, mixHex(ribbon, '#000000', 0.25));
  a.rect(5, 13, 2, 2, '#ffffff');
  a.set(24, 24, '#ffffff');
  a.outline(INK);
  return a.toCanvas();
}

function drawConfettiStrip(seed) {
  const w = 40;
  const h = 12;
  const a = new PixelArt(w, h);
  const rnd = seededRandom(seed);
  const cols = ['#ff6fa5', '#ffd23f', '#4fb3ff', '#5cc77a', '#a77bff', '#ffffff', '#ff8a3c'];
  // 红色底边 = 危险地波（要跳过）
  for (let x = 0; x < w; x++) if (x % 4 !== 3) a.set(x, h - 1, '#ff2d55');
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(rnd() * (w - 2));
    const y = Math.floor(rnd() * (h - 2));
    const col = cols[Math.floor(rnd() * cols.length)];
    if (rnd() < 0.5) a.rect(x, y, 2, 1, col);
    else a.rect(x, y, 1, 2, col);
  }
  return a.toCanvas();
}

function drawCoupon(color, mark) {
  const a = new PixelArt(12, 8);
  a.rect(0, 0, 12, 8, color);
  a.clear(0, 3);
  a.clear(0, 4);
  a.clear(11, 3);
  a.clear(11, 4);
  for (let x = 2; x < 10; x += 2) {
    a.set(x, 1, mark);
    a.set(x, 6, mark);
  }
  a.text('%', 4, 1, mark);
  return a;
}

/** 优惠券墙：一条横贯三道的纸片带（low = 低空跳过 / high = 高空滑铲） */
function drawCouponBand(kind) {
  const w = 118;
  const h = kind === 'low' ? 14 : 24;
  const a = new PixelArt(w, h);
  const rnd = seededRandom(kind === 'low' ? 11 : 23);
  const coupon = kind === 'low' ? drawCoupon('#ffe066', '#e05a00') : drawCoupon('#ff9cc4', '#c2185b');
  for (let y = 0; y < h - 6; y += 5) {
    for (let x = -4 + Math.floor(rnd() * 4); x < w - 6; x += 10) {
      const ox = x + Math.floor(rnd() * 3);
      const oy = y + Math.floor(rnd() * 3);
      for (let j = 0; j < 8; j++) for (let i = 0; i < 12; i++) {
        const c = coupon.buf[j * 12 + i];
        if (c) a.set(ox + i, oy + j, c);
      }
    }
  }
  a.outline(INK);
  return a.toCanvas();
}

// ------------------------------------------------------------------
// Boss · 喵喵（促销气球吉祥物）
// ------------------------------------------------------------------

function drawMeow(expr) {
  const W = 56;
  const H = 62;
  const a = new PixelArt(W, H);
  const cx = 28;
  const cy = 26;
  const pink = '#ff8fc0';
  const pinkDark = '#e566a3';
  const pinkLight = '#ffc9e0';
  const white = '#fff5fa';
  const cheek = '#ff5c93';
  // 气球绳 + 结
  for (let y = 47; y < H - 1; y++) a.set(cx + Math.round(Math.sin(y * 0.55)), y, '#8a7a90');
  a.tri(cx - 3, 48, cx + 3, 48, cx, 44, pinkDark);
  // 耳朵
  a.tri(cx - 19, 15, cx - 5, 8, cx - 16, 0, pink);
  a.tri(cx + 19, 15, cx + 5, 8, cx + 16, 0, pink);
  a.tri(cx - 16, 12, cx - 9, 8, cx - 15, 4, pinkLight);
  a.tri(cx + 16, 12, cx + 9, 8, cx + 15, 4, pinkLight);
  // 身体（下方阴影）
  a.disc(cx, cy, 20, pinkDark);
  a.disc(cx - 1.5, cy - 1.5, 18.5, pink);
  // 肚皮 + 促销符号
  a.ellipse(cx, cy + 9, 12, 8.5, white);
  a.text('%', cx - 1, cy + 7, pinkDark);
  // 高光
  a.ellipse(cx - 11, cy - 11, 3.2, 2.2, '#ffffff');
  a.set(cx - 6, cy - 15, '#ffffff');
  // 腮红
  a.ellipse(cx - 12, cy + 1, 3, 2, cheek);
  a.ellipse(cx + 12, cy + 1, 3, 2, cheek);
  // 眼睛
  const ex1 = cx - 7;
  const ex2 = cx + 7;
  const ey = cy - 4;
  if (expr === 'dizzy') {
    for (const ex of [ex1, ex2]) {
      a.ring(ex, ey, 3.2, 3.2, 1, INK);
      a.set(ex, ey, INK);
      a.set(ex - 1, ey, INK);
    }
  } else if (expr === 'hurt') {
    a.line(ex1 - 2, ey - 2, ex1 + 1, ey, INK);
    a.line(ex1 + 1, ey, ex1 - 2, ey + 2, INK);
    a.line(ex2 + 2, ey - 2, ex2 - 1, ey, INK);
    a.line(ex2 - 1, ey, ex2 + 2, ey + 2, INK);
  } else {
    a.ellipse(ex1, ey, 2, 3, INK);
    a.ellipse(ex2, ey, 2, 3, INK);
    a.set(ex1 - 1, ey - 2, '#ffffff');
    a.set(ex2 - 1, ey - 2, '#ffffff');
    if (expr === 'angry') {
      a.line(ex1 - 4, ey - 7, ex1 + 2, ey - 4, INK);
      a.line(ex2 + 4, ey - 7, ex2 - 2, ey - 4, INK);
    }
  }
  // 嘴
  const my = cy + 2;
  if (expr === 'angry') {
    a.ellipse(cx, my + 1, 3.2, 2.2, '#c2185b');
    a.rect(cx - 2, my, 4, 1, '#ffffff');
  } else if (expr === 'dizzy') {
    for (let i = -3; i <= 3; i++) a.set(cx + i, my + ((i & 1) ? 1 : 0), INK);
  } else if (expr === 'hurt') {
    a.ring(cx, my + 1, 2, 2, 1, INK);
  } else {
    a.set(cx - 3, my, INK);
    a.set(cx - 2, my + 1, INK);
    a.set(cx - 1, my + 1, INK);
    a.set(cx, my, INK);
    a.set(cx + 1, my + 1, INK);
    a.set(cx + 2, my + 1, INK);
    a.set(cx + 3, my, INK);
  }
  // 胡须
  a.line(cx - 14, cy - 1, cx - 21, cy - 3, INK);
  a.line(cx - 14, cy + 2, cx - 21, cy + 2, INK);
  a.line(cx + 14, cy - 1, cx + 21, cy - 3, INK);
  a.line(cx + 14, cy + 2, cx + 21, cy + 2, INK);
  // 小爪子
  a.disc(cx - 19, cy + 11, 3.6, pink);
  a.disc(cx + 19, cy + 11, 3.6, pink);
  a.outline(INK);
  return a;
}

// ------------------------------------------------------------------
// 招牌 & 墙面贴图
// ------------------------------------------------------------------

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';

/** 侧边悬挂招牌（面朝镜头），文字来自 config.memes.shopNames */
export function makeSign(text, color) {
  const tmp = makeCanvas(8, 8).getContext('2d');
  tmp.font = 'bold 10px ' + FONT;
  const tw = Math.ceil(tmp.measureText(text).width);
  const w = Math.max(40, tw + 12);
  const h = 22;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#8a7a90';
  g.fillRect(4, 0, 1, 5);
  g.fillRect(w - 5, 0, 1, 5);
  g.fillStyle = INK;
  g.fillRect(0, 4, w, h - 4);
  g.fillStyle = color;
  g.fillRect(1, 5, w - 2, h - 6);
  g.fillStyle = '#ffffff';
  g.fillRect(3, 7, w - 6, h - 10);
  g.fillStyle = color;
  g.font = 'bold 10px ' + FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 13 + 0.5);
  return c;
}

/** 店铺墙面贴图（128×96，对应 12m 长 × 12m 高的一段墙） */
function makeShopTexture(name, signColor, seed) {
  const W = 128;
  const H = 96;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const rnd = seededRandom(seed);
  // 檐口
  g.fillStyle = '#fff4f8';
  g.fillRect(0, 0, W, 8);
  g.fillStyle = '#ffc2da';
  g.fillRect(0, 6, W, 2);
  // 二楼立面
  g.fillStyle = '#f6d8e7';
  g.fillRect(0, 8, W, 33);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = '#ffffff';
    g.fillRect(12 + i * 28, 13, 22, 24);
    g.fillStyle = i % 2 ? '#e3f4ff' : '#fff0f6';
    g.fillRect(14 + i * 28, 15, 18, 20);
  }
  // 玻璃栏杆
  g.fillStyle = '#ffffff';
  g.fillRect(0, 40, W, 2);
  g.fillStyle = '#cdeeff';
  g.fillRect(0, 42, W, 5);
  g.fillStyle = '#ffffff';
  for (let x = 4; x < W; x += 10) g.fillRect(x, 42, 1, 5);
  // 楼板
  g.fillStyle = '#ffffff';
  g.fillRect(0, 47, W, 4);
  g.fillStyle = '#e9cfdd';
  g.fillRect(0, 50, W, 1);
  // 招牌
  g.fillStyle = INK;
  g.fillRect(10, 52, W - 20, 12);
  g.fillStyle = signColor;
  g.fillRect(11, 53, W - 22, 10);
  g.fillStyle = '#ffffff';
  g.font = 'bold 9px ' + FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, W / 2, 58.5);
  // 橱窗
  g.fillStyle = '#d6f3ff';
  g.fillRect(8, 64, W - 8, 28);
  g.fillStyle = '#ffffff';
  for (let x = 8; x < W; x += 30) g.fillRect(x, 64, 2, 28);
  g.fillRect(8, 64, W - 8, 2);
  // 门
  g.fillStyle = '#b9e2f5';
  g.fillRect(52, 68, 24, 24);
  g.fillStyle = '#ffffff';
  g.fillRect(63, 68, 2, 24);
  // 橱窗里的商品（礼盒 / 模特）
  const goods = ['#ff6fa5', '#ffd23f', '#a77bff', '#5cc77a', '#ff8a3c', '#4fb3ff'];
  for (let i = 0; i < 5; i++) {
    const x = 14 + Math.floor(rnd() * 30) + (i > 2 ? 64 : 0);
    const h = 5 + Math.floor(rnd() * 8);
    g.fillStyle = goods[Math.floor(rnd() * goods.length)];
    g.fillRect(x, 92 - h, 7, h);
    g.fillStyle = '#ffffff';
    g.fillRect(x + 3, 92 - h, 1, h);
  }
  // 玻璃反光
  g.fillStyle = 'rgba(255,255,255,0.65)';
  for (let k = 0; k < 3; k++) {
    const x0 = 18 + k * 36;
    for (let j = 0; j < 10; j++) g.fillRect(x0 + j, 66 + j * 2, 2, 2);
  }
  // 踢脚线
  g.fillStyle = signColor;
  g.fillRect(0, 92, W, 4);
  // 柱子
  g.fillStyle = '#ffffff';
  g.fillRect(0, 8, 8, H - 12);
  g.fillStyle = '#ffd6e7';
  g.fillRect(6, 8, 2, H - 12);
  return c;
}

// ------------------------------------------------------------------
// 对外：生成全部素材
// ------------------------------------------------------------------

function canvasOf(art, scale = 1) {
  const c = art.toCanvas();
  if (scale === 1) return c;
  const out = makeCanvas(art.w * scale, art.h * scale);
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(c, 0, 0, out.width, out.height);
  return out;
}

/** 按当前 G / B / ACC 生成一整套双人角色素材 */
function buildCharacterSet() {
  const S = {};
  // 主角背面：跑步 4 帧 + 跳 / 落 / 铲 / 受击 / 胜利
  const runPoses = [
    { legL: 'up', legR: 'down', armL: 'fwd', armR: 'back', pony: 1, bob: 0 },
    { legL: 'down', legR: 'down', armL: 'down', armR: 'down', pony: 0, bob: -1 },
    { legL: 'down', legR: 'up', armL: 'back', armR: 'fwd', pony: -1, bob: 0 },
    { legL: 'down', legR: 'down', armL: 'down', armR: 'down', pony: 0, bob: -1 },
  ];
  const poses = {
    run0: runPoses[0],
    run1: runPoses[1],
    run2: runPoses[2],
    run3: runPoses[3],
    jump: { legL: 'tuck', legR: 'tuck', armL: 'up', armR: 'up', pony: 0, flare: true },
    fall: { legL: 'down', legR: 'down', armL: 'out', armR: 'out', ponyUp: true, flare: true },
    hit: { legL: 'up', legR: 'down', armL: 'up', armR: 'up', ponyUp: true, pony: 1 },
    win: { legL: 'down', legR: 'down', armL: 'up', armR: 'up', pony: 0, bob: -1 },
  };
  S.girl = {};
  S.girlFlash = {};
  S.girlGhost = {};
  S.boy = {};
  S.boyFlash = {};
  S.boyGhost = {};
  for (const k of Object.keys(poses)) {
    const art = girlBack(poses[k]);
    S.girl[k] = canvasOf(art, 2);
    S.girlFlash[k] = canvasOf(art.silhouette('#ffffff'), 2);
    S.girlGhost[k] = canvasOf(art.silhouette('#9fe3ff'), 2);
    const boy = boyBack(poses[k]);
    S.boy[k] = canvasOf(boy, 2);
    S.boyFlash[k] = canvasOf(boy.silhouette('#ffffff'), 2);
    S.boyGhost[k] = canvasOf(boy.silhouette('#9fe3ff'), 2);
  }
  const slide = girlSlide();
  S.girl.slide = canvasOf(slide, 2);
  S.girlFlash.slide = canvasOf(slide.silhouette('#ffffff'), 2);
  S.girlGhost.slide = canvasOf(slide.silhouette('#9fe3ff'), 2);
  const bslide = boySlide();
  S.boy.slide = canvasOf(bslide, 2);
  S.boyFlash.slide = canvasOf(bslide.silhouette('#ffffff'), 2);
  S.boyGhost.slide = canvasOf(bslide.silhouette('#9fe3ff'), 2);

  // 主角正面（标题 / 结算）：4 倍大
  S.girlFront = {
    idle0: canvasOf(girlFront({ arms: 'down', eyes: 'open', mouth: 'smile', bob: 0 }), 4),
    idle1: canvasOf(girlFront({ arms: 'down', eyes: 'open', mouth: 'smile', bob: -1 }), 4),
    blink: canvasOf(girlFront({ arms: 'down', eyes: 'closed', mouth: 'smile', bob: 0 }), 4),
    wave0: canvasOf(girlFront({ arms: 'wave', eyes: 'open', mouth: 'open', bob: 0 }), 4),
    cheer0: canvasOf(girlFront({ arms: 'up', eyes: 'closed', mouth: 'open', bob: 0 }), 4),
    cheer1: canvasOf(girlFront({ arms: 'up', eyes: 'closed', mouth: 'open', bob: -1 }), 4),
    sad: canvasOf(girlFront({ arms: 'down', eyes: 'closed', mouth: 'sad', bob: 0 }), 4),
  };
  S.boyFront = {
    idle0: canvasOf(boyFront({ arms: 'down', eyes: 'open', bob: 0 }), 4),
    idle1: canvasOf(boyFront({ arms: 'down', eyes: 'open', bob: -1 }), 4),
    wave0: canvasOf(boyFront({ arms: 'wave', eyes: 'closed', bob: 0 }), 4),
    cheer0: canvasOf(boyFront({ arms: 'up', eyes: 'closed', bob: 0 }), 4),
  };
  const headIcon = (art) => {
    const c = makeCanvas(12, 10);
    c.getContext('2d').drawImage(art.toCanvas(), 2, 0, 12, 10, 0, 0, 12, 10);
    return c;
  };
  S.girlIcon = headIcon(girlFront({ arms: 'down', eyes: 'open', mouth: 'smile' }));
  S.boyIcon = headIcon(boyFront({ arms: 'down', eyes: 'open' }));
  return S;
}

const skinCache = {};
const CHARACTER_KEYS = ['girl', 'girlFlash', 'girlGhost', 'boy', 'boyFlash', 'boyGhost', 'girlFront', 'boyFront', 'girlIcon', 'boyIcon'];

/** 换皮肤：生成（并缓存）这套皮肤的双人素材，替换 SPRITES 里的角色图 */
export function applySkin(id) {
  const look = SKIN_LOOKS[id] || SKIN_LOOKS.default;
  if (!skinCache[id]) {
    G = look.girl;
    B = look.boy;
    ACC = look.acc;
    skinCache[id] = buildCharacterSet();
    G = GIRL;
    B = BOY;
    ACC = {};
  }
  const set = skinCache[id];
  for (const k of CHARACTER_KEYS) SPRITES[k] = set[k];
  SPRITES.skinId = id;
}

/** 商店预览用：某套皮肤的正面双人图 */
export function skinPreview(id) {
  const cur = SPRITES.skinId || 'default';
  applySkin(id);
  const set = skinCache[id];
  applySkin(cur);
  return { girl: set.girlFront.idle0, boy: set.boyFront.idle0 };
}

export function buildCommonSprites() {
  const S = SPRITES;
  applySkin('default');
  S.coin = [drawCoinFrame(5), drawCoinFrame(3), drawCoinFrame(1), drawCoinFrame(3)];
  S.heart = drawHeart('#ff3d7f', '#ffb3cf');
  S.heartEmpty = drawHeart('#c9b3c5', null);
  S.bossHeart = drawHeart('#ff8fc0', '#ffffff');
  S.magnet = drawMagnet();
  S.shield = drawShieldPickup();
  S.coinRain = drawCoinRain();
  S.springShoes = drawShoes();
  S.shieldIcon = drawShieldIcon();
  S.bolt = drawBolt('#ffd23f');
  S.boltPink = drawBolt('#ff6fa5');
  S.bubble = drawBubble(15);
  S.shadow = drawShadow(22, 7);
  S.ringRed = drawRing('#ff2d55', 70);
  S.ringGold = drawRing('#ffd23f', 90);
  S.ringPink = drawRing('#ff6fa5', 60);
  S.ringHollow = drawRing('#ff2d55', 0);
  S.pHeart = drawSmallHeart('#ff5c93');
  S.pHeartLight = drawSmallHeart('#ffb3cf');
  S.pStar = drawStar('#ffe066');
  S.pStarWhite = drawStar('#ffffff');
  S.photo = drawPhotoPickup();
  S.memory = drawMemoryItem();
  S.bun = drawBun(true);
  S.bosses = {};
  S.bossesFlash = {};
  S.bossIcons = {};
  S.levelAssets = {};
  S.dashArrow = drawDashArrow();
  return S;
}

/** 冲刺型还击的地面绿箭头（贴花） */
function drawDashArrow() {
  const a = new PixelArt(16, 12);
  for (let i = 0; i < 6; i++) {
    a.rect(2 + i, 9 - i, 2, 2, '#4dff88');
    a.rect(12 - i, 9 - i, 2, 2, '#4dff88');
  }
  a.rect(7, 2, 2, 2, '#c8ffd8');
  a.outline('#1d6b3a');
  return a.toCanvas();
}

/**
 * 金币中间的图案（彩蛋，config.coinMark）：一个字 / 符号，或一张图片路径（她的头像）。留空 = 默认小爱心
 */
export function applyCoinMark(mark) {
  if (!mark) return;
  const paint = (fn) => {
    const c = drawCoinFrame(5, true);
    const g = c.getContext('2d');
    g.save();
    g.beginPath();
    g.arc(6, 6, 3.8, 0, Math.PI * 2);
    g.clip();
    fn(g);
    g.restore();
    SPRITES.coin[0] = c;
  };
  if (/\.(png|jpe?g|gif|webp)$/i.test(mark) || mark.startsWith('data:')) {
    const img = new Image();
    img.onload = () => paint((g) => g.drawImage(img, 2, 2, 8, 8));
    img.src = mark;
  } else {
    const ch = Array.from(mark)[0];
    paint((g) => {
      g.fillStyle = '#c47a00';
      g.font = 'bold 7px ' + FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ch, 6, 6.5);
    });
  }
}

/** 照片碎片：小拍立得 */
function drawPhotoPickup() {
  const a = new PixelArt(14, 16);
  a.rect(1, 1, 12, 14, '#ffffff');
  a.rect(2, 2, 10, 9, '#9fdcff');
  a.rect(2, 8, 10, 3, '#8fe0a3');
  a.disc(9, 4.5, 1.6, '#ffe066');
  a.set(4, 6, '#ff6fa5');
  a.set(5, 5, '#ff6fa5');
  a.set(6, 6, '#ff6fa5');
  a.rect(4, 12, 6, 1, '#ffb3cf');
  a.outline(INK);
  return a.toCanvas();
}

/** 回忆道具（投掷型还击的备用弹药）：发光的小爱心盒 */
function drawMemoryItem() {
  const a = new PixelArt(14, 14);
  a.rect(2, 4, 10, 8, '#c3a3ff');
  a.rect(1, 3, 12, 3, '#e2d4ff');
  a.set(5, 7, '#ff5c93');
  a.set(8, 7, '#ff5c93');
  a.rect(5, 8, 4, 1, '#ff5c93');
  a.rect(6, 9, 2, 1, '#ff5c93');
  a.outline(INK);
  return a.toCanvas();
}

/** 菠萝油（波哥的弹药 / 反击投掷物） */
export function drawBun(glow) {
  const a = new PixelArt(16, 14);
  a.ellipse(8, 8, 7, 5, '#e8a21b');
  a.ellipse(8, 7, 6, 4, glow ? '#ffe066' : '#f5c242');
  for (let x = 3; x < 13; x += 3) a.set(x, 6 + ((x / 3) & 1), '#c97d10');
  a.rect(6, 9, 4, 2, '#fff6c2');
  a.outline(INK);
  return a.toCanvas();
}

/** 把 Boss 各表情的像素画登记到 SPRITES（渲染 / HUD 使用）；iconCrop = 头像裁剪框 */
export function registerBoss(key, arts, iconCrop) {
  const S = SPRITES;
  const norm = {};
  const flash = {};
  for (const e of Object.keys(arts)) {
    norm[e] = arts[e].toCanvas();
    flash[e] = arts[e].silhouette('#ffffff').toCanvas();
  }
  S.bosses[key] = norm;
  S.bossesFlash[key] = flash;
  const c = makeCanvas(14, 14);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(norm.normal, iconCrop[0], iconCrop[1], iconCrop[2], iconCrop[3], 0, 0, 14, 14);
  S.bossIcons[key] = c;
}

/** 商场关专属素材（障碍 / Boss / 弹幕 / 墙面 / 招牌） */
export function buildMallSprites(shopNames) {
  const S = SPRITES;
  S.cart = drawCart(false);
  S.cartBoss = drawCart(true);
  S.banner = [null, drawBanner(1), drawBanner(2), drawBanner(3)];
  S.planter = drawPlanter();
  S.tourists = [drawTourists(0), drawTourists(1)];
  S.giftBox = drawGiftBox('#ff4a5e', '#ff6f7f', '#ffd23f');
  S.blindBox = drawBlindBox();
  S.giantGift = drawGiantGift(false);
  S.giantGiftGlow = drawGiantGift(true);
  S.confetti = [drawConfettiStrip(3), drawConfettiStrip(5), drawConfettiStrip(9)];
  S.couponLow = drawCouponBand('low');
  S.couponHigh = drawCouponBand('high');

  const arts = {};
  for (const e of ['normal', 'angry', 'dizzy', 'hurt']) arts[e] = drawMeow(e);
  registerBoss('meow', arts, [6, 0, 44, 46]);

  const signColors = ['#ff5c9a', '#a77bff', '#4fb3ff', '#ff8a3c', '#5cc77a', '#e0559c', '#f5a623', '#7c6cff'];
  const signs = [];
  const walls = [];
  const names = shopNames && shopNames.length ? shopNames : ['商场'];
  for (let i = 0; i < names.length; i++) {
    const col = signColors[i % signColors.length];
    signs.push(makeSign(names[i], col));
    walls.push(makeShopTexture(names[i], col, 101 + i * 17));
  }
  S.signEscUp = makeSign('↑ 扶梯 上 2F  速度UP!', '#ff6fa5');
  S.signEscDown = makeSign('↓ 扶梯 下 1F', '#4fb3ff');
  S.levelAssets[1] = { walls, signs, sky: null };
  return S;
}
