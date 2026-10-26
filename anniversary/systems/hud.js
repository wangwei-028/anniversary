import { SPRITES, INK } from './sprites.js';
import { Pool } from './pool.js';
import { JUICE } from '../data/constants.js';
import { TEXTS } from '../data/texts.js';

/**
 * 局内 HUD：画在主画布上（坐标 = 缓冲像素，但文字按屏幕分辨率渲染，所以中文清晰）。
 * 包含：爱心 / 护盾 / 还击能量 / 金币计数（金币飞入动画）/ 进度条 / Boss 血条 / 道具计时 /
 *      区段横幅 / 教学提示 / 飘字 / Boss 名条 / LOVE FEVER 宣告。
 */
const FAMILY = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';
const fontCache = {};
function font(size, weight) {
  // 字号按 0.5 取整，避免动画缩放时缓存无限增长
  size = Math.round(size * 2) / 2;
  const key = size + '|' + weight;
  let f = fontCache[key];
  if (!f) {
    f = weight + ' ' + size + 'px ' + FAMILY;
    fontCache[key] = f;
  }
  return f;
}

export function drawText(ctx, str, x, y, size, color, align = 'center', stroke = INK, weight = 900) {
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, size * 0.3);
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

const POWERUP_ORDER = ['magnet', 'coinRain', 'springShoes'];

export class Hud {
  constructor() {
    this.flyers = new Pool(() => ({ x0: 0, y0: 0, cx: 0, cy: 0, t: 0, dur: 0.4, value: 1 }), 64);
    this.texts = new Pool(() => ({ text: '', x: 0, y: 0, vy: 0, life: 0, max: 1, color: '#fff', size: 10 }), 24);
    this.bannerText = '';
    this.bannerSub = '';
    this.bannerT = 0;
    this.bannerDur = 0;
    this.tipText = '';
    this.tipT = 0;
    this.tipDur = 0;
    this.displayCoins = 0;
    this.coinBump = 0;
    this.coinStr = '0';
    this.coinStrVal = 0;
    this.nameCardT = -1;
    this.nameCardDur = 0;
    this.nameCardName = '';
    this.nameCardTitle = '';
    this.feverT = -1;
    this.feverDur = 0;
    this.feverBadge = false;
    this.energyFlash = 0;
    this.time = 0;
    this.coinTargetX = 0;
    this.coinTargetY = 9;
    this.centerText = '';
    this.centerT = 0;
  }

  reset(coins) {
    this.flyers.releaseAll();
    this.texts.releaseAll();
    this.displayCoins = coins;
    this.bannerDur = 0;
    this.tipDur = 0;
    this.nameCardT = -1;
    this.feverT = -1;
    this.feverBadge = false;
    this.centerText = '';
  }

  banner(text, sub, dur = 1.8) {
    this.bannerText = text;
    this.bannerSub = sub || '';
    this.bannerT = 0;
    this.bannerDur = dur;
  }

  tip(text, dur = 2.8) {
    this.tipText = text;
    this.tipT = 0;
    this.tipDur = dur;
  }

  clearTip() {
    this.tipDur = 0;
  }

  /** 横幅 / 提示是否还在播放（Boss 登场要等它们放完，别让教学字被 Boss 演出顶掉） */
  busy() {
    return this.bannerT < this.bannerDur || this.tipT < this.tipDur;
  }

  /** 屏幕中央的大号提示（如 Boss 战的"反击时机！"） */
  center(text, dur = 1.2) {
    this.centerText = text;
    this.centerT = dur;
  }

  pop(text, x, y, color, size = 11, life = 0.75) {
    const t = this.texts.obtain();
    t.text = text;
    t.x = x;
    t.y = y;
    t.vy = -26;
    t.life = life;
    t.max = life;
    t.color = color;
    t.size = size;
  }

  /** 金币从屏幕位置 (x, y) 飞向计数器 */
  coinFly(x, y, value) {
    const f = this.flyers.obtain();
    f.x0 = x;
    f.y0 = y;
    f.cx = x + (Math.random() * 40 - 20);
    f.cy = Math.min(y, 60) - 20 - Math.random() * 20;
    f.t = 0;
    f.dur = JUICE.coinFlyTime * (0.85 + Math.random() * 0.3);
    f.value = value;
  }

  showNameCard(name, title, dur) {
    this.nameCardT = 0;
    this.nameCardDur = dur;
    this.nameCardName = name;
    this.nameCardTitle = title;
  }

  showFever(dur) {
    this.feverT = 0;
    this.feverDur = dur;
    this.feverBadge = true;
  }

  flashEnergy() {
    this.energyFlash = 0.8;
  }

  /** 真实时间更新（子弹时间里 UI 也照常流动） */
  update(dt) {
    this.time += dt;
    if (this.bannerT < this.bannerDur) this.bannerT += dt;
    if (this.tipT < this.tipDur) this.tipT += dt;
    if (this.centerT > 0) this.centerT -= dt;
    if (this.nameCardT >= 0) {
      this.nameCardT += dt;
      if (this.nameCardT > this.nameCardDur) this.nameCardT = -1;
    }
    if (this.feverT >= 0) {
      this.feverT += dt;
      if (this.feverT > this.feverDur) this.feverT = -1;
    }
    if (this.coinBump > 0) this.coinBump -= dt * 5;
    if (this.energyFlash > 0) this.energyFlash -= dt;
    const fl = this.flyers.items;
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i];
      if (!f.active) continue;
      f.t += dt;
      if (f.t >= f.dur) {
        f.active = false;
        this.displayCoins += f.value;
        this.coinBump = 1;
      }
    }
    const tx = this.texts.items;
    for (let i = 0; i < tx.length; i++) {
      const t = tx[i];
      if (!t.active) continue;
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-4 * dt);
      if (t.life <= 0) t.active = false;
    }
  }

  /** 结算前把还在飞的金币直接记上 */
  flushCoins(real) {
    this.flyers.releaseAll();
    this.displayCoins = real;
  }

  /**
   * opts: { mode: 'run'|'boss', progress, bossName, bossHp, bossMaxHp, attempt, maxAttempts, debug }
   */
  render(ctx, W, H, s, opts) {
    const S = SPRITES;
    ctx.imageSmoothingEnabled = false;

    // ---- 爱心 + 护盾 ----
    let hx = 4;
    for (let i = 0; i < s.maxHearts; i++) {
      ctx.drawImage(i < s.hearts ? S.heart : S.heartEmpty, hx, 4);
      hx += 12;
    }
    for (let i = 0; i < s.shield; i++) {
      ctx.drawImage(S.shieldIcon, hx, 3);
      hx += 12;
    }
    if (opts.mode === 'boss' && s.bossShield > 0) {
      ctx.drawImage(S.shieldIcon, hx, 3);
      drawText(ctx, 'B', hx + 8, 11, 5, '#ffd23f', 'center');
      hx += 12;
    }

    // ---- 技能条「回忆闪光」：完美闪避充能，满了双击屏幕 / L 释放 ----
    const full = s.energy >= 0.999;
    ctx.drawImage(full && Math.floor(this.time * 6) & 1 ? S.boltPink : S.bolt, 3, 15);
    ctx.fillStyle = INK;
    ctx.fillRect(10, 17, 36, 5);
    ctx.fillStyle = '#fff6fa';
    ctx.fillRect(11, 18, 34, 3);
    ctx.fillStyle = full ? (Math.floor(this.time * 8) & 1 ? '#ffd23f' : '#ff6fa5') : '#ff6fa5';
    ctx.fillRect(11, 18, Math.round(34 * s.energy), 3);
    if (full) drawText(ctx, 'MAX', 49, 19.5, 5, '#ffd23f', 'left', INK, 900);
    if (full) {
      const a = 0.6 + 0.4 * Math.sin(this.time * 7);
      ctx.globalAlpha = a;
      drawText(ctx, '双击/L 闪光!', 11, 26, 5, '#ffe066', 'left', INK, 900);
      ctx.globalAlpha = 1;
    }

    // ---- 男友酱守护换人：在场角色头像 + 环形 CD ----
    let leftY = 30;
    if (s.partner) {
      const icx = 11;
      const icy = 33;
      const ready = s.swapCd <= 0;
      const prog = ready ? 1 : 1 - s.swapCd / s.swapCdMax;
      const col = s.fever ? '#ff6fa5' : ready ? '#ffd23f' : '#ffffff';
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(icx, icy, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(icx, icy, 7.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(icx, icy, 7.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
      ctx.stroke();
      if (ready) {
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(this.time * 6);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(icx, icy, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(s.character === 'boy' ? S.boyIcon : S.girlIcon, icx - 6, icy - 5);
      leftY = 48;
    }
    if (s.ammo > 0) {
      ctx.drawImage(S.memory, 3, leftY - 6, 10, 10);
      drawText(ctx, '×' + s.ammo, 15, leftY - 1, 6, '#ffffff', 'left');
      leftY += 11;
    }

    // ---- 金币计数 ----
    if (this.displayCoins !== this.coinStrVal) {
      this.coinStrVal = this.displayCoins;
      this.coinStr = String(this.displayCoins);
    }
    const cx = Math.round(W / 2 - 14);
    this.coinTargetX = cx + 6;
    this.coinTargetY = 9;
    const bump = this.coinBump > 0 ? this.coinBump : 0;
    const cs = 12 + Math.round(bump * 4);
    ctx.drawImage(S.coin[0], cx + 6 - cs / 2, 9 - cs / 2, cs, cs);
    drawText(ctx, this.coinStr, cx + 14, 9.5, 9 + bump * 2, '#ffffff', 'left');
    if (s.powerups.coinRain > 0) drawText(ctx, '×2', cx + 16 + this.coinStr.length * 6, 9.5, 6, '#ffd23f', 'left');

    // ---- 进度条 / Boss 血条 ----
    if (opts.mode === 'run') {
      const x0 = 26;
      const x1 = W - 26;
      const y = 30;
      ctx.fillStyle = INK;
      ctx.fillRect(x0 - 1, y - 2, x1 - x0 + 2, 4);
      ctx.fillStyle = '#ffe3ee';
      ctx.fillRect(x0, y - 1, x1 - x0, 2);
      ctx.fillStyle = '#ff6fa5';
      const px = x0 + Math.round((x1 - x0) * opts.progress);
      ctx.fillRect(x0, y - 1, px - x0, 2);
      if (opts.bossIcon) ctx.drawImage(opts.bossIcon, x1 - 4, y - 8);
      ctx.drawImage(s.character === 'boy' ? S.boyIcon : S.girlIcon, px - 6, y - 6);
    } else if (opts.mode === 'endless') {
      drawText(ctx, '分数 ' + opts.score, W / 2, 26, 8, '#ffe066');
      drawText(ctx, '最高 ' + opts.best + (opts.cameo ? ' · ' + opts.cameo : ''), W / 2, 36, 5.5, '#ffffff');
    } else if (opts.mode === 'boss') {
      const y = 25;
      drawText(ctx, opts.bossName, W / 2, y, 7, '#ffffff');
      const n = opts.bossMaxHp;
      const startX = Math.round(W / 2 - (n * 12) / 2);
      for (let i = 0; i < n; i++) {
        ctx.drawImage(i < opts.bossHp ? S.bossHeart : S.heartEmpty, startX + i * 12, y + 5);
      }
      drawText(ctx, opts.rushLabel || '挑战 ' + opts.attempt + '/' + opts.maxAttempts, 4, leftY, 6, opts.rushLabel ? '#ffe066' : '#ffffff', 'left');
      if (this.feverBadge) {
        const a = 0.75 + 0.25 * Math.sin(this.time * 9);
        ctx.globalAlpha = a;
        drawText(ctx, '♥ LOVE FEVER', 4, leftY + 9, 5.5, '#ff6fa5', 'left', '#ffffff');
        ctx.globalAlpha = 1;
      }
    }

    // ---- 道具剩余时间 ----
    let py = 26;
    for (let i = 0; i < POWERUP_ORDER.length; i++) {
      const id = POWERUP_ORDER[i];
      const left = s.powerups[id];
      if (left <= 0) continue;
      const icon = S[id];
      const x = W - 16;
      ctx.drawImage(icon, Math.round(x - icon.width / 2), Math.round(py - icon.height / 2));
      ctx.strokeStyle = left < 2 && Math.floor(this.time * 8) & 1 ? '#ff2d55' : '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, py, 8.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, left / 8));
      ctx.stroke();
      py += 19;
    }

    // ---- 飘字 ----
    const tx = this.texts.items;
    for (let i = 0; i < tx.length; i++) {
      const t = tx[i];
      if (!t.active) continue;
      const k = t.life / t.max;
      const age = t.max - t.life;
      const pop = age < 0.1 ? 0.6 + (age / 0.1) * 0.6 : age < 0.2 ? 1.2 - ((age - 0.1) / 0.1) * 0.2 : 1;
      ctx.globalAlpha = k < 0.3 ? k / 0.3 : 1;
      drawText(ctx, t.text, t.x, t.y, t.size * pop, t.color);
    }
    ctx.globalAlpha = 1;

    // ---- 金币飞入 ----
    const fl = this.flyers.items;
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i];
      if (!f.active) continue;
      const t = f.t / f.dur;
      const e = t * t;
      const u = 1 - e;
      const x = u * u * f.x0 + 2 * u * e * f.cx + e * e * this.coinTargetX;
      const y = u * u * f.y0 + 2 * u * e * f.cy + e * e * this.coinTargetY;
      const size = Math.round(12 - t * 4);
      ctx.drawImage(S.coin[Math.floor(f.t * 14) & 3], Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    }

    // ---- 区段横幅 ----
    if (this.bannerT < this.bannerDur) this.renderBanner(ctx, W, H);

    // ---- 教学提示 ----
    if (this.tipT < this.tipDur) this.renderTip(ctx, W, H);

    // ---- 中央大字 ----
    if (this.centerT > 0) {
      const a = Math.min(1, this.centerT / 0.25);
      ctx.globalAlpha = a;
      const sc = 1 + Math.max(0, this.centerT - 0.9) * 0.6;
      drawText(ctx, this.centerText, W / 2, H * 0.62, 14 * sc, '#ffe066');
      ctx.globalAlpha = 1;
    }

    // ---- Boss 名条 / LOVE FEVER ----
    if (this.nameCardT >= 0) this.renderNameCard(ctx, W, H);
    if (this.feverT >= 0) this.renderFever(ctx, W, H);

    // ---- 投掷型还击的蓄力条 ----
    const bar = opts.throwBar;
    if (bar && (bar.active || bar.resultT > 0)) this.renderThrowBar(ctx, W, H, bar);

    if (opts.debug) {
      drawText(ctx, opts.debug, 3, H - 6, 5, '#ffffff', 'left', INK, 700);
    }
  }

  renderBanner(ctx, W, H) {
    const t = this.bannerT;
    const d = this.bannerDur;
    let a = 1;
    let off = 0;
    if (t < 0.2) {
      off = (1 - t / 0.2) * W * 0.6;
      a = t / 0.2;
    } else if (t > d - 0.3) {
      const k = (t - (d - 0.3)) / 0.3;
      off = -k * W * 0.6;
      a = 1 - k;
    }
    const y = Math.round(H * 0.55);
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = INK;
    ctx.fillRect(0, y - 13, W, this.bannerSub ? 30 : 24);
    ctx.fillStyle = '#ff6fa5';
    ctx.fillRect(0, y - 13, W, 2);
    ctx.fillRect(0, y + (this.bannerSub ? 15 : 9), W, 2);
    ctx.globalAlpha = a;
    drawText(ctx, this.bannerText, W / 2 + off, y - 1, 13, '#ffffff', 'center', null);
    if (this.bannerSub) drawText(ctx, this.bannerSub, W / 2 + off * 1.2, y + 10, 6.5, '#ffd6e7', 'center', null, 700);
    ctx.globalAlpha = 1;
  }

  renderTip(ctx, W, H) {
    const t = this.tipT;
    const d = this.tipDur;
    const a = t < 0.15 ? t / 0.15 : t > d - 0.3 ? Math.max(0, (d - t) / 0.3) : 1;
    const y = Math.round(H - 22);
    ctx.globalAlpha = a;
    ctx.font = font(7, 800);
    const w = Math.min(W - 8, Math.ceil(ctx.measureText(this.tipText).width) + 14);
    const x = Math.round((W - w) / 2);
    ctx.fillStyle = INK;
    ctx.fillRect(x - 1, y - 8, w + 2, 16);
    ctx.fillStyle = '#fff6fa';
    ctx.fillRect(x, y - 7, w, 14);
    ctx.fillStyle = '#ff6fa5';
    ctx.fillRect(x, y - 7, 3, 14);
    drawText(ctx, this.tipText, W / 2 + 1, y + 0.5, 7, INK, 'center', null, 800);
    ctx.globalAlpha = 1;
  }

  renderThrowBar(ctx, W, H, bar) {
    const w = Math.min(130, W - 40);
    const x = Math.round((W - w) / 2);
    const y = Math.round(H - 48);
    ctx.globalAlpha = bar.active ? 1 : Math.min(1, bar.resultT / 0.3);
    ctx.fillStyle = INK;
    ctx.fillRect(x - 2, y - 2, w + 4, 12);
    ctx.fillStyle = '#fff6fa';
    ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = Math.floor(this.time * 10) & 1 ? '#ff2d55' : '#ff5c7f';
    ctx.fillRect(x + Math.round(bar.zoneStart * w), y, Math.round(bar.zoneWidth * w), 8);
    const nx = x + Math.round(bar.needle * w);
    ctx.fillStyle = INK;
    ctx.fillRect(nx - 1, y - 5, 3, 18);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(nx, y - 4, 1, 16);
    ctx.drawImage(SPRITES.bun, x - 18, y - 4);
    if (bar.active) drawText(ctx, '红区时按 J / 点屏幕！', W / 2, y - 11, 7, '#ffffff');
    else drawText(ctx, bar.result === 'hit' ? '正中红心！' : '偏了~', W / 2, y - 11, 9, bar.result === 'hit' ? '#ffe066' : '#c9b3c5');
    ctx.globalAlpha = 1;
  }

  renderNameCard(ctx, W, H) {
    const t = this.nameCardT;
    const d = this.nameCardDur;
    let off = 0;
    if (t < 0.18) off = (1 - t / 0.18) * W;
    const a = t > d - 0.25 ? Math.max(0, (d - t) / 0.25) : 1;
    const y = Math.round(H * 0.5);
    ctx.globalAlpha = a;
    ctx.fillStyle = INK;
    ctx.fillRect(off - 2, y - 18, W + 4, 36);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(off, y - 18, W, 2);
    ctx.fillRect(off, y + 16, W, 2);
    // 斜纹
    ctx.fillStyle = 'rgba(255,111,165,0.25)';
    for (let i = -2; i < W / 10 + 2; i++) ctx.fillRect(off + i * 10 + ((t * 40) % 10), y - 16, 4, 32);
    drawText(ctx, this.nameCardTitle, W / 2 + off * 1.3, y - 7, 7, '#ffd6e7', 'center', null, 800);
    drawText(ctx, this.nameCardName, W / 2 + off * 0.8, y + 6, 17, '#ffffff', 'center', '#c2185b');
    ctx.globalAlpha = 1;
  }

  renderFever(ctx, W, H) {
    const t = this.feverT;
    const d = this.feverDur;
    const a = t > d - 0.3 ? Math.max(0, (d - t) / 0.3) : 1;
    const beat = Math.abs(Math.sin(t * 9));
    const pop = t < 0.15 ? 0.4 + (t / 0.15) * 0.9 : 1.15 + beat * 0.12;
    const y = H * 0.4;
    ctx.globalAlpha = a;
    drawText(ctx, TEXTS.loveFever, W / 2, y, 17 * pop, '#ff6fa5', 'center', '#ffffff');
    drawText(ctx, TEXTS.loveFever, W / 2, y, 17 * pop, '#ff6fa5', 'center', null);
    drawText(ctx, '羁绊燃烧 · 守护换人 CD 减半', W / 2, y + 16, 6.5, '#ffffff', 'center', '#c2185b', 800);
    ctx.globalAlpha = 1;
  }
}
